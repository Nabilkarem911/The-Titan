import { loadConfig } from '@titan/config';
import { TokenBucketRateLimiter, buildHybridKey, incCounter } from '@titan/observability';
import { type QueueName } from '@titan/shared';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'queue-rate-limiter' });

const limiters = new Map<QueueName, TokenBucketRateLimiter>();

function getLimiter(queue: QueueName): TokenBucketRateLimiter {
  let l = limiters.get(queue);
  if (!l) {
    const c = loadConfig();
    l = new TokenBucketRateLimiter({
      capacity: c.QUEUE_ENQUEUE_RATE_PER_MIN,
      refillPerSecond: c.QUEUE_ENQUEUE_RATE_PER_MIN / 60,
      name: `queue_enqueue:${queue}`,
    });
    l.startCleanup();
    limiters.set(queue, l);
  }
  return l;
}

export interface EnqueueCheckOpts {
  queue: QueueName;
  userId?: string;
  apiKeyId?: string;
  workspaceId?: string;
  cost?: number;
}

export interface EnqueueCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  key: string;
}

export function checkEnqueueRate(opts: EnqueueCheckOpts): EnqueueCheckResult {
  const limiter = getLimiter(opts.queue);
  const key = buildHybridKey({
    userId: opts.userId,
    apiKeyId: opts.apiKeyId,
  }) + `|q:${opts.queue}`;
  const r = limiter.take(key, opts.cost ?? 1);
  if (!r.allowed) {
    incCounter('queue_enqueue_rejected_total', 'Queue enqueues rejected by rate limiter', 1, { queue: opts.queue });
    log.warn({ queue: opts.queue, retryAfterMs: r.retryAfterMs }, 'enqueue rate limited');
  }
  return { ...r, key };
}

export function resetQueueRateLimits(): void {
  for (const l of limiters.values()) l.reset();
}

export function stopQueueRateLimits(): void {
  for (const l of limiters.values()) l.stopCleanup();
  limiters.clear();
}
