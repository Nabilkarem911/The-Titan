import { describe, it, expect, afterEach } from 'vitest';
import {
  checkEnqueueRate,
  resetQueueRateLimits,
  stopQueueRateLimits,
} from './rate-limit.js';
import { QUEUE_NAMES } from '@titan/shared';

afterEach(() => {
  // Clean up limiter state and intervals between tests
  stopQueueRateLimits();
});

describe('checkEnqueueRate', () => {
  it('allows the first request', () => {
    const result = checkEnqueueRate({
      queue: QUEUE_NAMES.AGENT_EXECUTE,
      userId: 'user-1',
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.retryAfterMs).toBe(0);
  });

  it('returns a key that includes queue name', () => {
    const result = checkEnqueueRate({
      queue: QUEUE_NAMES.AGENT_EXECUTE,
      userId: 'user-2',
    });
    expect(result.key).toContain(QUEUE_NAMES.AGENT_EXECUTE);
  });

  it('returns a key containing userId segment', () => {
    const result = checkEnqueueRate({
      queue: QUEUE_NAMES.TOOL_EXECUTE,
      userId: 'user-abc',
    });
    expect(result.key).toContain('u:user-abc');
  });

  it('returns a key containing apiKeyId segment', () => {
    const result = checkEnqueueRate({
      queue: QUEUE_NAMES.TOOL_EXECUTE,
      apiKeyId: 'key-xyz',
    });
    expect(result.key).toContain('k:key-xyz');
  });

  it('returns a key with "anon" when no identity is provided', () => {
    const result = checkEnqueueRate({
      queue: QUEUE_NAMES.MEMORY_INDEX,
    });
    expect(result.key).toContain('anon');
  });

  it('decrements remaining tokens on successive calls', () => {
    const first = checkEnqueueRate({
      queue: QUEUE_NAMES.AUDIT_WRITE,
      userId: 'drain-test',
    });
    const second = checkEnqueueRate({
      queue: QUEUE_NAMES.AUDIT_WRITE,
      userId: 'drain-test',
    });
    expect(second.remaining).toBeLessThan(first.remaining);
  });

  it('respects custom cost parameter', () => {
    const baseline = checkEnqueueRate({
      queue: QUEUE_NAMES.WEBHOOK_DELIVER,
      userId: 'cost-test',
      cost: 1,
    });
    const expensive = checkEnqueueRate({
      queue: QUEUE_NAMES.WEBHOOK_DELIVER,
      userId: 'cost-test',
      cost: 10,
    });
    // After consuming 1 + 10 = 11 tokens total, remaining should drop accordingly
    expect(expensive.remaining).toBeLessThan(baseline.remaining);
  });

  it('result shape matches EnqueueCheckResult interface', () => {
    const result = checkEnqueueRate({
      queue: QUEUE_NAMES.AGENT_EXECUTE,
      userId: 'shape-test',
    });
    expect(result).toHaveProperty('allowed');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('retryAfterMs');
    expect(result).toHaveProperty('key');
    expect(typeof result.allowed).toBe('boolean');
    expect(typeof result.remaining).toBe('number');
    expect(typeof result.retryAfterMs).toBe('number');
    expect(typeof result.key).toBe('string');
  });
});

describe('resetQueueRateLimits', () => {
  it('restores tokens after reset', () => {
    // Consume some tokens
    for (let i = 0; i < 10; i++) {
      checkEnqueueRate({
        queue: QUEUE_NAMES.MEMORY_RETRIEVE,
        userId: 'reset-test',
      });
    }
    const beforeReset = checkEnqueueRate({
      queue: QUEUE_NAMES.MEMORY_RETRIEVE,
      userId: 'reset-test',
    });

    resetQueueRateLimits();

    const afterReset = checkEnqueueRate({
      queue: QUEUE_NAMES.MEMORY_RETRIEVE,
      userId: 'reset-test',
    });
    expect(afterReset.remaining).toBeGreaterThan(beforeReset.remaining);
  });
});
