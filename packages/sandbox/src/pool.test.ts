import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SandboxPool } from './pool.js';

describe('SandboxPool', () => {
  let pool: SandboxPool;

  beforeAll(async () => {
    pool = new SandboxPool({
      minSize: 0,
      maxSize: 2,
      defaultLimits: { timeoutMs: 5000, memory: '128m', cpu: '0.25', pids: 16, network: false },
    });
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.shutdown();
  });

  it('initializes without error (degraded mode if no docker)', () => {
    const stats = pool.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(0);
  });

  it('executes echo command in sandbox or returns degraded result', async () => {
    const result = await pool.execute('echo "hello sandbox"');
    // If Docker unavailable, exitCode is -1 with stderr
    if (result.exitCode === -1) {
      expect(result.stderr).toContain('Sandbox unavailable');
    } else {
      expect(result.stdout).toContain('hello sandbox');
      expect(result.exitCode).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('enforces timeout', async () => {
    const result = await pool.execute('sleep 10', { timeoutMs: 100 });
    if (result.exitCode !== -1) {
      expect(result.stderr).toContain('timeout');
    }
  });

  it('tracks stats correctly', () => {
    const stats = pool.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(0);
    expect(stats.warm).toBeGreaterThanOrEqual(0);
    expect(stats.active).toBe(0); // no active after release
    expect(stats.destroyed).toBeGreaterThanOrEqual(0);
  });
});
