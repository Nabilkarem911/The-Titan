import { incCounter, observeHistogram } from './metrics.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'rate-limiter' });

export interface RateLimitConfig {
  capacity: number;
  refillPerSecond: number;
  name: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  reason?: string;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, Bucket>();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  startCleanup(intervalMs = 60_000): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.evictStale(), intervalMs);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private evictStale(): void {
    const now = Date.now();
    const cutoff = now - 5 * 60_000;
    for (const [k, b] of this.buckets.entries()) {
      if (b.lastRefill < cutoff) this.buckets.delete(k);
    }
  }

  take(key: string, cost = 1): RateLimitResult {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.config.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      const elapsedSec = (now - bucket.lastRefill) / 1000;
      const refilled = elapsedSec * this.config.refillPerSecond;
      if (refilled > 0) {
        bucket.tokens = Math.min(this.config.capacity, bucket.tokens + refilled);
        bucket.lastRefill = now;
      }
    }
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      incCounter('rate_limiter_allowed_total', 'Requests allowed by rate limiter', 1, { limiter: this.config.name });
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }
    const deficit = cost - bucket.tokens;
    const retryAfterMs = Math.ceil((deficit / this.config.refillPerSecond) * 1000);
    incCounter('rate_limiter_rejected_total', 'Requests rejected by rate limiter', 1, { limiter: this.config.name });
    observeHistogram('rate_limiter_retry_after_ms', 'Retry-after in ms for rejected requests', retryAfterMs);
    return { allowed: false, remaining: 0, retryAfterMs, reason: 'token_bucket_exhausted' };
  }

  reset(key?: string): void {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }

  size(): number {
    return this.buckets.size;
  }
}

export function buildHybridKey(parts: { ip?: string; userId?: string; apiKeyId?: string }): string {
  const segs: string[] = [];
  if (parts.ip) segs.push(`ip:${parts.ip}`);
  if (parts.userId) segs.push(`u:${parts.userId}`);
  if (parts.apiKeyId) segs.push(`k:${parts.apiKeyId}`);
  return segs.length > 0 ? segs.join('|') : 'anon';
}

log.debug('rate-limiter module loaded');
