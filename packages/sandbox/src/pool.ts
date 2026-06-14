import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import type { SandboxContainer, SandboxPoolConfig, SandboxExecResult, SandboxLimits } from './types.js';

const log = getLogger().child({ component: 'sandbox-pool' });

export class SandboxPool {
  private containers: Map<string, SandboxContainer> = new Map();
  private config: SandboxPoolConfig;
  private initialized = false;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private docker: unknown; // lazy-loaded dockerode

  constructor(config: Partial<SandboxPoolConfig> = {}) {
    this.config = {
      image: 'alpine:latest',
      minSize: 2,
      maxSize: 8,
      recycleAfterExecutions: 50,
      recycleAfterSeconds: 3600,
      healthCheckIntervalMs: 30_000,
      startupTimeoutMs: 10_000,
      defaultLimits: { timeoutMs: 120_000, memory: '512m', cpu: '0.5', pids: 64, network: false },
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    log.info(this.config, 'initializing sandbox pool');

    // Lazy-load dockerode to avoid startup failure if Docker is unavailable
    try {
      const Docker = (await import('dockerode')).default;
      this.docker = new Docker();
      log.info('docker client connected');
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'docker unavailable; sandbox will operate in degraded mode');
      this.docker = null;
    }

    if (this.docker) {
      await this.warmPool();
      this.healthTimer = setInterval(() => this.healthCheck(), this.config.healthCheckIntervalMs);
      this.healthTimer.unref?.();
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    if (!this.docker) return;

    const docker = this.docker as { getContainer: (id: string) => { remove: (opts: { force: boolean }) => Promise<unknown> } };
    for (const container of this.containers.values()) {
      if (container.status !== 'destroyed') {
        try {
          await docker.getContainer(container.dockerId).remove({ force: true });
          container.status = 'destroyed';
        } catch (err) {
          log.warn({ containerId: container.dockerId, err: err instanceof Error ? err.message : 'Unknown' }, 'failed to remove container on shutdown');
        }
      }
    }
    this.containers.clear();
    this.initialized = false;
    log.info('sandbox pool shutdown complete');
  }

  async execute(command: string, limits?: Partial<SandboxLimits>): Promise<SandboxExecResult> {
    const _start = performance.now();
    const container = await this.acquire();

    if (!container) {
      return {
        exitCode: -1,
        stdout: '',
        stderr: 'Sandbox unavailable: no Docker connection',
        durationMs: 0,
        oomKilled: false,
      };
    }

    try {
      const result = await this.execInContainer(container, command, limits);
      container.lastUsedAt = new Date();
      container.execCount++;
      observeHistogram('sandbox_exec_duration_ms', 'Sandbox execution duration', result.durationMs, [10, 50, 100, 500, 1000, 5000, 30000]);
      incCounter('sandbox_exec_total', 'Sandbox executions', 1, { status: result.exitCode === 0 ? 'ok' : 'error' });
      return result;
    } finally {
      await this.release(container);
    }
  }

  private async warmPool(): Promise<void> {
    if (!this.docker) return;
    const warm = Array.from(this.containers.values()).filter((c) => c.status === 'warm').length;
    const needed = this.config.minSize - warm;
    if (needed <= 0) return;

    log.info({ needed }, 'warming sandbox pool');
    for (let i = 0; i < needed; i++) {
      await this.createContainer();
    }
  }

  private async createContainer(): Promise<SandboxContainer | null> {
    if (!this.docker) return null;
    const docker = this.docker as {
      createContainer: (opts: Record<string, unknown>) => Promise<{ id: string; start: () => Promise<unknown> }>;
    };

    const name = `titan-sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const mounts: Array<Record<string, unknown>> = [];
    if (this.config.workspaceMount) {
      mounts.push({
        Type: 'bind',
        Source: this.config.workspaceMount,
        Target: '/workspace',
        ReadOnly: true,
      });
    }

    const networkMode = (this.config.defaultLimits.network ?? false) ? 'bridge' : 'none';

    try {
      const dockerContainer = await docker.createContainer({
        Image: this.config.image,
        name,
        Cmd: ['sh', '-c', 'while true; do sleep 60; done'],
        HostConfig: {
          AutoRemove: false,
          NetworkMode: networkMode,
          Memory: this.parseMemory(this.config.defaultLimits.memory),
          CpuPeriod: 100_000,
          CpuQuota: Math.round(100_000 * parseFloat(this.config.defaultLimits.cpu ?? '0.5')),
          PidsLimit: this.config.defaultLimits.pids ?? 64,
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges:true'],
          ReadonlyRootfs: true,
          Tmpfs: { '/tmp': 'noexec,nosuid,size=100m' },
          Binds: this.config.workspaceMount ? [`${this.config.workspaceMount}:/workspace:ro`] : [],
        },
        Labels: {
          'titan.sandbox': 'true',
          'titan.sandbox.version': '0.1.0',
          ...(this.config.labels ?? {}),
        },
      });

      await dockerContainer.start();

      const container: SandboxContainer = {
        id: name,
        dockerId: dockerContainer.id,
        status: 'warm',
        createdAt: new Date(),
        lastUsedAt: null,
        execCount: 0,
        labels: this.config.labels ?? {},
      };

      this.containers.set(container.id, container);
      incCounter('sandbox_container_created_total', 'Sandbox containers created', 1);
      return container;
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : 'Unknown' }, 'failed to create sandbox container');
      return null;
    }
  }

  private async acquire(): Promise<SandboxContainer | null> {
    if (!this.docker) return null;

    // Find a warm container
    for (const c of this.containers.values()) {
      if (c.status === 'warm') {
        c.status = 'active';
        return c;
      }
    }

    // Create one if below max
    if (this.containers.size < this.config.maxSize) {
      return await this.createContainer();
    }

    log.warn('sandbox pool exhausted');
    return null;
  }

  private async release(container: SandboxContainer): Promise<void> {
    const shouldRecycle =
      container.execCount >= this.config.recycleAfterExecutions ||
      (container.createdAt && Date.now() - container.createdAt.getTime() > this.config.recycleAfterSeconds * 1000);

    if (shouldRecycle) {
      container.status = 'recycling';
      await this.destroyContainer(container);
      await this.createContainer(); // Replace
    } else {
      container.status = 'warm';
    }
  }

  private async destroyContainer(container: SandboxContainer): Promise<void> {
    if (!this.docker || container.status === 'destroyed') return;
    const docker = this.docker as { getContainer: (id: string) => { remove: (opts: { force: boolean }) => Promise<unknown> } };

    try {
      await docker.getContainer(container.dockerId).remove({ force: true });
      container.status = 'destroyed';
      this.containers.delete(container.id);
      incCounter('sandbox_container_destroyed_total', 'Sandbox containers destroyed', 1);
    } catch (err) {
      log.warn({ containerId: container.dockerId, err: err instanceof Error ? err.message : 'Unknown' }, 'failed to destroy container');
    }
  }

  private async execInContainer(
    container: SandboxContainer,
    command: string,
    limits?: Partial<SandboxLimits>,
  ): Promise<SandboxExecResult> {
    if (!this.docker) {
      return { exitCode: -1, stdout: '', stderr: 'No docker', durationMs: 0, oomKilled: false };
    }

    const docker = this.docker as { getContainer: (id: string) => { exec: (opts: Record<string, unknown>) => Promise<{ start: (opts: Record<string, unknown>) => Promise<unknown>; id: string }> } };
    const timeout = limits?.timeoutMs ?? this.config.defaultLimits.timeoutMs;

    const execStart = performance.now();
    try {
      const exec = await docker.getContainer(container.dockerId).exec({
        Cmd: ['sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
      });

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      const stream = (await exec.start({ Detach: false, Tty: false })) as { on: (event: string, cb: (data: Buffer) => void) => void };

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Sandbox timeout')), timeout);
        stream.on('data', (chunk: Buffer) => {
          // Docker multiplexed stream: first 8 bytes are header
          if (chunk.length >= 8) {
            const streamType = chunk[0];
            const payload = chunk.subarray(8);
            if (streamType === 1) chunks.push(payload); // stdout
            else if (streamType === 2) errChunks.push(payload); // stderr
            else chunks.push(payload); // default
          } else {
            chunks.push(chunk);
          }
        });
        stream.on('end', () => {
          clearTimeout(timer);
          resolve();
        });
        stream.on('error', (err: unknown) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const stdout = Buffer.concat(chunks).toString('utf-8');
      const stderr = Buffer.concat(errChunks).toString('utf-8');
      const durationMs = Math.round(performance.now() - execStart);

      // Check exec result
      const execInfo = (await (docker.getContainer(container.dockerId) as unknown as { exec: { inspect: (id: string) => Promise<{ ExitCode: number; OOMKilled?: boolean }> } }).exec.inspect(exec.id)) as { ExitCode: number; OOMKilled?: boolean };

      return {
        exitCode: execInfo.ExitCode ?? 0,
        stdout: stdout.slice(0, 1024 * 1024), // truncate to 1MB
        stderr: stderr.slice(0, 256 * 1024),  // truncate to 256KB
        durationMs,
        oomKilled: execInfo.OOMKilled ?? false,
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - execStart);
      return {
        exitCode: -1,
        stdout: '',
        stderr: err instanceof Error ? err.message : 'Sandbox execution error',
        durationMs,
        oomKilled: false,
      };
    }
  }

  private async healthCheck(): Promise<void> {
    if (!this.docker) return;
    const docker = this.docker as { getContainer: (id: string) => { inspect: () => Promise<{ State: { Running: boolean; Status: string } }> } };

    for (const container of this.containers.values()) {
      if (container.status === 'destroyed') continue;
      try {
        const info = await docker.getContainer(container.dockerId).inspect();
        if (!info.State.Running) {
          log.warn({ containerId: container.id }, 'sandbox container not running; recycling');
          await this.destroyContainer(container);
          await this.createContainer();
        }
      } catch (err) {
        log.warn({ containerId: container.id, err: err instanceof Error ? err.message : 'Unknown' }, 'sandbox health check failed');
        await this.destroyContainer(container);
        await this.createContainer();
      }
    }

    // Ensure min pool size
    await this.warmPool();
  }

  private parseMemory(mem?: string): number | undefined {
    if (!mem) return undefined;
    const match = mem.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
    if (!match) return undefined;
    const value = parseFloat(match[1]);
    const unit = (match[2] ?? 'b').toLowerCase();
    const multipliers: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
    return Math.floor(value * (multipliers[unit] ?? 1));
  }

  getStats(): { total: number; warm: number; active: number; destroyed: number } {
    const all = Array.from(this.containers.values());
    return {
      total: all.length,
      warm: all.filter((c) => c.status === 'warm').length,
      active: all.filter((c) => c.status === 'active').length,
      destroyed: all.filter((c) => c.status === 'destroyed').length,
    };
  }
}
