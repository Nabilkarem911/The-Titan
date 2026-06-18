import { getLogger } from '@titan/logging';
import type { AgentPoolConfig, SpawnRequest, ChildAgent } from './types.js';
import { AgentSpawner, type AgentSpawnerDeps } from './agent-spawner.js';

const log = getLogger().child({ component: 'agent-pool' });

const DEFAULT_CONFIG: AgentPoolConfig = {
  maxConcurrent: 10,
  maxQueueSize: 50,
  defaultTimeout: 300000,
  warmPoolSize: 3,
};

export class AgentPool {
  private config: AgentPoolConfig;
  private spawner: AgentSpawner;
  private activeCount = 0;
  private queue: Array<{ request: SpawnRequest; resolve: (child: ChildAgent) => void; reject: (err: Error) => void }> = [];

  constructor(deps: AgentSpawnerDeps, config?: Partial<AgentPoolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.spawner = new AgentSpawner(deps);
  }

  async submit(request: SpawnRequest): Promise<ChildAgent> {
    if (this.activeCount < this.config.maxConcurrent) {
      return this.runNow(request);
    }

    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error(`Agent pool queue full (${this.config.maxQueueSize} max)`);
    }

    return new Promise<ChildAgent>((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      log.debug({ queueSize: this.queue.length }, 'agent queued');
    });
  }

  async submitBatch(requests: SpawnRequest[]): Promise<ChildAgent[]> {
    const sorted = [...requests].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return Promise.all(sorted.map((r) => this.submit(r)));
  }

  getStats(): { active: number; queued: number; maxConcurrent: number } {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrent: this.config.maxConcurrent,
    };
  }

  getSpawner(): AgentSpawner {
    return this.spawner;
  }

  private async runNow(request: SpawnRequest): Promise<ChildAgent> {
    this.activeCount++;
    try {
      const child = await this.spawner.spawn(request);
      return child;
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.activeCount < this.config.maxConcurrent) {
      const next = this.queue.shift()!;
      this.activeCount++;
      this.spawner.spawn(next.request)
        .then((child) => {
          this.activeCount--;
          next.resolve(child);
          this.processQueue();
        })
        .catch((err) => {
          this.activeCount--;
          next.reject(err instanceof Error ? err : new Error(String(err)));
          this.processQueue();
        });
    }
  }
}
