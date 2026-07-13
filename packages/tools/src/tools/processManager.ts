import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function sanitizePid(pid: unknown): number {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0 || n > 4194304) {
    throw new Error('Invalid pid: must be a positive integer');
  }
  return n;
}

function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') throw new Error('Invalid process name');
  if (/[;&|`$<>]/.test(name)) throw new Error('Invalid process name: contains forbidden characters');
  const cleaned = name.replace(/[^\w.\- ]/g, '').trim();
  if (!cleaned) throw new Error('Invalid process name');
  if (cleaned.length > 200) throw new Error('Process name too long');
  return cleaned;
}

export async function processManager(params: { action: 'list' | 'info' | 'find'; name?: string; pid?: number }): Promise<string> {
  const isWindows = process.platform === 'win32';

  switch (params.action) {
    case 'list': {
      try {
        const cmd = isWindows ? 'tasklist' : 'ps';
        const args = isWindows ? ['/FO', 'CSV'] : ['aux', '--sort=-%mem'];
        const { stdout } = await execFileAsync(cmd, args, { encoding: 'utf-8', timeout: 5000, maxBuffer: 512 * 1024 });
        const lines = stdout.trim().split('\n').slice(0, 20);
        return JSON.stringify({ processes: lines, count: lines.length });
      } catch {
        return JSON.stringify({ processes: [], note: 'Process listing not available in this environment' });
      }
    }
    case 'info': {
      if (!params.pid) throw new Error('pid required');
      const pid = sanitizePid(params.pid);
      try {
        if (isWindows) {
          const { stdout } = await execFileAsync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV'], { encoding: 'utf-8', timeout: 5000, maxBuffer: 256 * 1024 });
          return JSON.stringify({ pid, info: stdout.trim() });
        } else {
          const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'pid,ppid,%cpu,%mem,comm,etime'], { encoding: 'utf-8', timeout: 5000, maxBuffer: 256 * 1024 });
          return JSON.stringify({ pid, info: stdout.trim() });
        }
      } catch {
        return JSON.stringify({ pid, error: 'Process not found or not accessible' });
      }
    }
    case 'find': {
      if (!params.name) throw new Error('name required');
      const name = sanitizeName(params.name);
      try {
        if (isWindows) {
          const { stdout } = await execFileAsync('tasklist', ['/FI', `IMAGENAME eq ${name}*`, '/FO', 'CSV'], { encoding: 'utf-8', timeout: 5000, maxBuffer: 256 * 1024 });
          const lines = stdout.trim().split('\n').filter(Boolean);
          return JSON.stringify({ name, found: lines.length, processes: lines });
        } else {
          const { stdout } = await execFileAsync('pgrep', ['-la', name], { encoding: 'utf-8', timeout: 5000, maxBuffer: 256 * 1024 });
          const lines = stdout.trim().split('\n').filter(Boolean);
          return JSON.stringify({ name, found: lines.length, processes: lines });
        }
      } catch {
        return JSON.stringify({ name, found: 0, processes: [] });
      }
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
