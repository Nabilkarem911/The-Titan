import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenBucketRateLimiter, buildHybridKey } from './rate-limiter.js';

/* ------------------------------------------------------------------ */
/*  TokenBucketRateLimiter                                             */
/* ------------------------------------------------------------------ */

describe('TokenBucketRateLimiter', () => {
  let limiter: TokenBucketRateLimiter;

  beforeEach(() => {
    limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillPerSecond: 1,
      name: 'test',
    });
  });

  describe('allows requests under limit', () => {
    it('allows the first request from a new key', () => {
      const result = limiter.take('user:1');
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it('reports correct remaining tokens', () => {
      const result = limiter.take('user:1');
      expect(result.remaining).toBe(4);
    });

    it('allows multiple requests up to capacity', () => {
      for (let i = 0; i < 5; i++) {
        const result = limiter.take('user:1');
        expect(result.allowed).toBe(true);
      }
    });

    it('allows requests with custom cost', () => {
      const result = limiter.take('user:1', 3);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('blocks requests over limit', () => {
    it('rejects when tokens are exhausted', () => {
      for (let i = 0; i < 5; i++) {
        limiter.take('user:1');
      }
      const result = limiter.take('user:1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toBe('token_bucket_exhausted');
    });

    it('provides a positive retryAfterMs', () => {
      for (let i = 0; i < 5; i++) {
        limiter.take('user:1');
      }
      const result = limiter.take('user:1');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('rejects when single cost exceeds remaining tokens', () => {
      limiter.take('user:1', 3); // 2 remaining
      const result = limiter.take('user:1', 3);
      expect(result.allowed).toBe(false);
    });
  });

  describe('window reset / refill behavior', () => {
    it('refills tokens over time', () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.take('user:1');
      }
      expect(limiter.take('user:1').allowed).toBe(false);

      // Advance time by 3 seconds => 3 tokens refilled
      vi.useFakeTimers();
      vi.advanceTimersByTime(3000);

      const result = limiter.take('user:1');
      expect(result.allowed).toBe(true);

      vi.useRealTimers();
    });

    it('never refills above capacity', () => {
      // Take one token
      limiter.take('user:1');

      // Advance time by a large amount
      vi.useFakeTimers();
      vi.advanceTimersByTime(60_000);

      // First take should report capacity - 1 remaining (capped at capacity then minus 1)
      const result = limiter.take('user:1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // capacity(5) - 1 = 4

      vi.useRealTimers();
    });
  });

  describe('key isolation', () => {
    it('tracks separate buckets per key', () => {
      for (let i = 0; i < 5; i++) {
        limiter.take('user:1');
      }
      expect(limiter.take('user:1').allowed).toBe(false);

      // Different key should still have full capacity
      const result = limiter.take('user:2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('reset', () => {
    it('resets a specific key', () => {
      for (let i = 0; i < 5; i++) {
        limiter.take('user:1');
      }
      limiter.reset('user:1');
      expect(limiter.take('user:1').allowed).toBe(true);
      expect(limiter.take('user:1').remaining).toBe(3);
    });

    it('resets all keys when called without argument', () => {
      limiter.take('user:1');
      limiter.take('user:2');
      expect(limiter.size()).toBe(2);

      limiter.reset();
      expect(limiter.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('returns number of tracked buckets', () => {
      expect(limiter.size()).toBe(0);
      limiter.take('a');
      limiter.take('b');
      limiter.take('c');
      expect(limiter.size()).toBe(3);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  buildHybridKey                                                     */
/* ------------------------------------------------------------------ */

describe('buildHybridKey', () => {
  it('builds key from ip only', () => {
    expect(buildHybridKey({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });

  it('builds key from userId only', () => {
    expect(buildHybridKey({ userId: 'abc' })).toBe('u:abc');
  });

  it('builds key from apiKeyId only', () => {
    expect(buildHybridKey({ apiKeyId: 'key123' })).toBe('k:key123');
  });

  it('combines multiple parts with pipe separator', () => {
    expect(buildHybridKey({ ip: '1.2.3.4', userId: 'u1', apiKeyId: 'k1' }))
      .toBe('ip:1.2.3.4|u:u1|k:k1');
  });

  it('returns "anon" when no parts provided', () => {
    expect(buildHybridKey({})).toBe('anon');
  });

  it('skips undefined parts', () => {
    expect(buildHybridKey({ ip: undefined, userId: 'u1' })).toBe('u:u1');
  });
});
