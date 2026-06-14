import { describe, it, expect } from 'vitest';
import { validateCwd, validateCommand, truncateOutput } from './sandbox.js';

describe('Sandbox', () => {
  it('allows cwd inside allowed prefix', () => {
    const cwd = validateCwd(process.cwd(), { allowedCwdPrefixes: [process.cwd()] });
    expect(cwd).toBe(process.cwd());
  });

  it('rejects cwd outside allowed prefix', () => {
    expect(() => validateCwd('/etc', { allowedCwdPrefixes: [process.cwd()] })).toThrow('outside allowed');
  });

  it('rejects forbidden commands', () => {
    expect(() => validateCommand('rm -rf /', { forbiddenCommands: ['rm -rf /'] })).toThrow('forbidden');
  });

  it('allows safe commands', () => {
    expect(() => validateCommand('echo hello', { forbiddenCommands: ['rm -rf /'] })).not.toThrow();
  });

  it('truncates output over max bytes', () => {
    const big = 'x'.repeat(2000);
    const result = truncateOutput(big, 1000);
    expect(result).toContain('...output truncated...');
    expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(1100);
  });
});
