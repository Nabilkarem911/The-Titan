import { describe, it, expect } from 'vitest';
import { executeBash } from './bash.js';

describe('executeBash', () => {
  it('runs echo successfully', async () => {
    const result = await executeBash({ command: 'echo hello', timeoutMs: 5000 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.truncated).toBe(false);
  });

  it('returns exit code 1 for invalid command', async () => {
    const result = await executeBash({ command: 'invalid_command_xyz_123', timeoutMs: 5000 });
    expect(result.exitCode).toBe(1);
  });

  it('respects timeout', async () => {
    const result = await executeBash({ command: 'node -e "setTimeout(() => {}, 5000)"', timeoutMs: 100 });
    expect(result.exitCode).not.toBe(0);
  });

  it('rejects forbidden patterns', async () => {
    await expect(executeBash({ command: 'rm -rf /', timeoutMs: 5000 })).rejects.toThrow('forbidden');
  });

  it('allows custom cwd', async () => {
    const command = process.platform === 'win32' ? 'cd' : 'pwd';
    const result = await executeBash({ command, cwd: process.cwd(), timeoutMs: 5000 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim().toLowerCase()).toBe(process.cwd().toLowerCase());
  });
});
