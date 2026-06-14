import { getLogger } from '@titan/logging';
import type { DockerOrchestratorInput } from '../schemas.js';

const log = getLogger().child({ component: 'tool-docker' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Docker: any = null;
async function getDocker(): Promise<any> {
  if (Docker) return Docker;
  try {
    const mod = await import('dockerode');
    Docker = mod.default ?? mod;
    return Docker;
  } catch {
    log.warn('dockerode not installed or Docker unavailable');
    return null;
  }
}

export async function dockerOrchestrate(input: DockerOrchestratorInput): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
}> {
  const { action, containerName, image, command, env, ports, volumes } = input;
  log.info({ action, containerName, image }, 'docker orchestrate');

  const DockerCtor = await getDocker();
  if (!DockerCtor) {
    return { success: false, error: 'dockerode is not installed or Docker daemon is unavailable' };
  }

  const docker = new DockerCtor();

  try {
    switch (action) {
      case 'list': {
        const containers: any[] = await docker.listContainers({ all: true });
        return { success: true, data: containers.map((c: any) => ({ id: c.Id, names: c.Names, state: c.State, image: c.Image })) };
      }
      case 'run': {
        if (!image) return { success: false, error: 'image is required for run' };
        const createOpts: any = {
          Image: image,
          name: containerName,
          Cmd: command ? command.split(' ') : undefined,
          Env: env ? Object.entries(env).map(([k, v]) => `${k}=${v}`) : undefined,
          HostConfig: {
            PortBindings: ports
              ? Object.fromEntries(Object.entries(ports).map(([k, v]) => [`${k}/tcp`, [{ HostPort: v }]]))
              : undefined,
            Binds: volumes,
          },
        };
        const container = await docker.createContainer(createOpts);
        await container.start();
        return { success: true, data: { id: container.id, name: containerName } };
      }
      case 'stop': {
        if (!containerName) return { success: false, error: 'containerName is required for stop' };
        const container = docker.getContainer(containerName);
        await container.stop();
        return { success: true, data: { stopped: containerName } };
      }
      case 'remove': {
        if (!containerName) return { success: false, error: 'containerName is required for remove' };
        const container = docker.getContainer(containerName);
        await container.remove({ force: true });
        return { success: true, data: { removed: containerName } };
      }
      case 'logs': {
        if (!containerName) return { success: false, error: 'containerName is required for logs' };
        const container = docker.getContainer(containerName);
        const logs = await container.logs({ stdout: true, stderr: true, tail: 100 });
        return { success: true, data: { logs: logs.toString('utf-8') } };
      }
      case 'exec': {
        if (!containerName || !command) {
          return { success: false, error: 'containerName and command are required for exec' };
        }
        const container = docker.getContainer(containerName);
        const exec = await container.exec({
          Cmd: command.split(' '),
          AttachStdout: true,
          AttachStderr: true,
        });
        const stream = await exec.start({ hijack: true, stdin: false });
        // Simplified: collect stdout/stderr
        let output = '';
        stream.on('data', (chunk: Buffer) => {
          output += chunk.toString('utf-8');
        });
        await new Promise<void>((resolve) => stream.on('end', resolve));
        return { success: true, data: { output: output.substring(0, 50_000) } };
      }
      default:
        return { success: false, error: `Unsupported action: ${action}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Docker error';
    log.error({ action, containerName, err: msg }, 'docker action failed');
    return { success: false, error: msg };
  }
}
