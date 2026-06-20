import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getLogger } from '@titan/logging';
import { loadConfig } from '@titan/config';
import { validateCwd, validateCommand, truncateOutput } from '../sandbox.js';
import type { ExecuteBashInput } from '../schemas.js';

const log = getLogger().child({ component: 'tool-bash' });
const execFileAsync = promisify(execFile);

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
    if (loadConfig().SANDBOX_STRICT_MODE) {
      throw new Error('Sandbox strict mode is enabled but sandbox is unavailable. Host execution is not allowed.');
    }
  }

  log.info({ command: command.substring(0, 100), cwd: resolvedCwd }, 'executing bash command');

  try {
    // Use platform-appropriate shell to execute command safely.
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd' : 'sh';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];
    const { stdout, stderr } = await execFileAsync(shell, shellArgs, {
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
    const e = err as { stdout?: string; stderr?: string; killed?: boolean; code?: number | string | null; status?: number | null };
    const exitCode = typeof e.code === 'number' ? e.code : (e.status ?? 1);
    log.warn({ command: command.substring(0, 100), exitCode, killed: e.killed }, 'bash command failed');
    return {
      stdout: truncateOutput(e.stdout ?? '', 512_000),
      stderr: truncateOutput(e.stderr ?? (typeof e.code === 'string' ? `Error: ${e.code}` : ''), 256_000),
      exitCode,
      truncated: false,
    };
  }
}
