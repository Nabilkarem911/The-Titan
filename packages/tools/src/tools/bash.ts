import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getLogger } from '@titan/logging';
import { validateCwd, validateCommand, truncateOutput } from '../sandbox.js';
import type { ExecuteBashInput } from '../schemas.js';

const log = getLogger().child({ component: 'tool-bash' });
const execAsync = promisify(exec);

let sandboxPool: import('@titan/sandbox').SandboxPool | null = null;

export async function getOrCreateSandboxPool(): Promise<import('@titan/sandbox').SandboxPool | null> {
  if (sandboxPool) return sandboxPool;
  try {
    const { SandboxPool } = await import('@titan/sandbox');
    sandboxPool = new SandboxPool();
    await sandboxPool.initialize();
    return sandboxPool;
  } catch {
    return null;
  }
}

export async function executeBash(input: ExecuteBashInput): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
}> {
  const { command, cwd, timeoutMs, env, useSandbox } = input;

  validateCommand(command);
  const resolvedCwd = cwd ? validateCwd(cwd) : process.cwd();

  // If sandbox requested and available, use isolated container execution
  if (useSandbox) {
    const pool = await getOrCreateSandboxPool();
    if (pool) {
      log.info({ command: command.substring(0, 100) }, 'executing bash command in sandbox');
      const result = await pool.execute(command, { timeoutMs: timeoutMs ?? 10_000 });
      return {
        stdout: truncateOutput(result.stdout, 512_000),
        stderr: truncateOutput(result.stderr, 256_000),
        exitCode: result.exitCode,
        truncated: false,
      };
    }
    log.warn('sandbox requested but unavailable; falling back to host execution');
  }

  log.info({ command: command.substring(0, 100), cwd: resolvedCwd }, 'executing bash command');

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: resolvedCwd,
      timeout: timeoutMs ?? 10_000,
      env: env ? { ...process.env, ...env } : process.env,
      maxBuffer: 1024 * 1024, // 1 MB combined stdout+stderr
      windowsHide: true,
    });

    const outLen = Buffer.byteLength(stdout, 'utf-8');
    const errLen = Buffer.byteLength(stderr, 'utf-8');
    const truncated = outLen > 512_000 || errLen > 512_000;

    return {
      stdout: truncateOutput(stdout, 512_000),
      stderr: truncateOutput(stderr, 256_000),
      exitCode: 0,
      truncated,
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; killed?: boolean; code?: number | null };
    log.warn({ command: command.substring(0, 100), exitCode: e.code, killed: e.killed }, 'bash command failed');
    return {
      stdout: truncateOutput(e.stdout ?? '', 512_000),
      stderr: truncateOutput(e.stderr ?? '', 256_000),
      exitCode: e.code ?? 1,
      truncated: false,
    };
  }
}
