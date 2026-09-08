import { describe, it, expect } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker.js';
import { Bulkhead, BulkheadFullError } from './bulkhead.js';
import { HealthAggregator } from './health-aggregator.js';

// ── Circuit Breaker ──

describe('CircuitBreaker', () => {
  it('allows calls in closed state', async () => {
    const cb = new CircuitBreaker({ name: 'test' });
    const result = await cb.execute(async () => 'ok');
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('closed');
  });

  it('opens after failure threshold', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2 });

    for (let i = 0; i < 2; i++) {
      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    }

    expect(cb.getState()).toBe('open');
    await expect(cb.execute(async () => 'ok')).rejects.toThrow(CircuitOpenError);
  });

  it('transitions to half-open after reset timeout', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, resetTimeout: 50 });

    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    expect(cb.getState()).toBe('open');

    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe('half_open');
  });

  it('closes after successful half-open call', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, resetTimeout: 50 });

    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    await new Promise((r) => setTimeout(r, 60));

    await cb.execute(async () => 'recovered');
    expect(cb.getState()).toBe('closed');
  });

  it('re-opens on failure in half-open', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, resetTimeout: 50 });

    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    await new Promise((r) => setTimeout(r, 60));

    await cb.execute(async () => { throw new Error('still broken'); }).catch(() => {});
    expect(cb.getState()).toBe('open');
  });

  it('resets manually', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1 });
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    expect(cb.getState()).toBe('open');

    cb.reset();
    expect(cb.getState()).toBe('closed');
  });

  it('reports stats', () => {
    const cb = new CircuitBreaker({ name: 'llm-provider' });
    const stats = cb.getStats();
    expect(stats.name).toBe('llm-provider');
    expect(stats.state).toBe('closed');
    expect(stats.failures).toBe(0);
  });
});

// ── Bulkhead ──

describe('Bulkhead', () => {
  it('allows calls up to max concurrent', async () => {
    const bh = new Bulkhead({ name: 'test', maxConcurrent: 2 });
    const results = await Promise.all([
      bh.execute(async () => 'a'),
      bh.execute(async () => 'b'),
    ]);
    expect(results).toEqual(['a', 'b']);
  });

  it('queues excess calls', async () => {
    const bh = new Bulkhead({ name: 'test', maxConcurrent: 1, maxQueue: 5, queueTimeout: 5000 });
    const order: string[] = [];

    const p1 = bh.execute(async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push('first');
      return 'first';
    });
    const p2 = bh.execute(async () => {
      order.push('second');
      return 'second';
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual(['first', 'second']);
  });

  it('rejects when queue is full', async () => {
    const bh = new Bulkhead({ name: 'test', maxConcurrent: 1, maxQueue: 0 });

    const blocker = bh.execute(() => new Promise((r) => setTimeout(r, 500)));
    await expect(bh.execute(async () => 'overflow')).rejects.toThrow(BulkheadFullError);

    // Cleanup
    await blocker;
  });

  it('reports stats', () => {
    const bh = new Bulkhead({ name: 'agent-pool', maxConcurrent: 5 });
    const stats = bh.getStats();
    expect(stats.name).toBe('agent-pool');
    expect(stats.maxConcurrent).toBe(5);
    expect(stats.active).toBe(0);
  });
});

// ── Health Aggregator ──

describe('HealthAggregator', () => {
  it('reports healthy when all checks pass', async () => {
    const agg = new HealthAggregator();
    agg.registerCheck('db', async () => ({ status: 'healthy', latencyMs: 5 }), true);
    agg.registerCheck('redis', async () => ({ status: 'healthy', latencyMs: 2 }));

    const report = await agg.check();
    expect(report.overall).toBe('healthy');
    expect(report.services.length).toBe(2);
  });

  it('reports unhealthy when critical service fails', async () => {
    const agg = new HealthAggregator();
    agg.registerCheck('db', async () => ({ status: 'unhealthy', message: 'Connection refused' }), true);
    agg.registerCheck('redis', async () => ({ status: 'healthy' }));

    const report = await agg.check();
    expect(report.overall).toBe('unhealthy');
  });

  it('reports degraded when non-critical fails', async () => {
    const agg = new HealthAggregator();
    agg.registerCheck('db', async () => ({ status: 'healthy' }), true);
    agg.registerCheck('embed', async () => ({ status: 'unhealthy', message: 'Slow' }), false);

    const report = await agg.check();
    expect(report.overall).toBe('degraded');
  });

  it('handles check timeout', async () => {
    const agg = new HealthAggregator();
    agg.registerCheck('slow', async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { status: 'healthy' };
    });

    const report = await agg.check();
    expect(report.services[0].status).toBe('healthy');
  });

  it('reports uptime', async () => {
    const agg = new HealthAggregator();
    agg.registerCheck('test', async () => ({ status: 'healthy' }));

    const report = await agg.check();
    expect(report.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('caches results', async () => {
    const agg = new HealthAggregator();
    agg.registerCheck('db', async () => ({ status: 'healthy' }), true);

    await agg.check();
    const cached = agg.getCached();
    expect(cached.services.length).toBe(1);
  });

  it('unregisters checks', async () => {
    const agg = new HealthAggregator();
    agg.registerCheck('temp', async () => ({ status: 'healthy' }));
    agg.unregisterCheck('temp');

    const report = await agg.check();
    expect(report.services.length).toBe(0);
  });
});
