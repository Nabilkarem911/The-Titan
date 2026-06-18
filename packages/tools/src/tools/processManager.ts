import { execSync } from 'node:child_process';

export async function processManager(params: { action: 'list' | 'info' | 'find'; name?: string; pid?: number }): Promise<string> {
  switch (params.action) {
    case 'list': {
      try {
        const output = execSync('ps aux --sort=-%mem 2>/dev/null || tasklist /FO CSV 2>nul', { encoding: 'utf-8', timeout: 5000 });
        const lines = output.trim().split('\n').slice(0, 20);
        return JSON.stringify({ processes: lines, count: lines.length });
      } catch {
        return JSON.stringify({ processes: [], note: 'Process listing not available in this environment' });
      }
    }
    case 'info': {
      if (!params.pid) throw new Error('pid required');
      try {
        const output = execSync(`ps -p ${params.pid} -o pid,ppid,%cpu,%mem,comm,etime 2>/dev/null || tasklist /FI "PID eq ${params.pid}" /FO CSV 2>nul`, { encoding: 'utf-8', timeout: 5000 });
        return JSON.stringify({ pid: params.pid, info: output.trim() });
      } catch {
        return JSON.stringify({ pid: params.pid, error: 'Process not found or not accessible' });
      }
    }
    case 'find': {
      if (!params.name) throw new Error('name required');
      try {
        const output = execSync(`pgrep -la "${params.name}" 2>/dev/null || tasklist /FI "IMAGENAME eq ${params.name}*" /FO CSV 2>nul`, { encoding: 'utf-8', timeout: 5000 });
        const lines = output.trim().split('\n').filter(Boolean);
        return JSON.stringify({ name: params.name, found: lines.length, processes: lines });
      } catch {
        return JSON.stringify({ name: params.name, found: 0, processes: [] });
      }
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
