import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { type QueueName } from '@titan/shared';
import { incCounter } from '@titan/observability';

const log = getLogger().child({ component: 'dlq' });

export interface DLQOptions {
  source: QueueName;
  reason: 'poison' | 'non_retryable' | 'manual';
  originalJobId?: string;
  attemptsMade?: number;
  failedReason?: string;
}

const dlqCache = new Map<string, Queue>();

function dlqName(source: QueueName): string {
  const c = loadConfig();
  return `${source}${c.QUEUE_DLQ_SUFFIX}`;
}

function connectionOpts(): ConnectionOptions {
  const c = loadConfig();
  return {
    host: c.REDIS_HOST,
    port: c.REDIS_PORT,
    password: c.REDIS_PASSWORD || undefined,
    db: c.REDIS_DB,
    keyPrefix: c.REDIS_KEY_PREFIX,
    tls: c.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

export function getDLQ(source: QueueName): Queue {
  const name = dlqName(source);
  let q = dlqCache.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: connectionOpts(),
      prefix: loadConfig().REDIS_KEY_PREFIX,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
    dlqCache.set(name, q);
  }
  return q;
}

export async function moveToDLQ(source: QueueName, data: unknown, opts: DLQOptions): Promise<string> {
  const dlq = getDLQ(source);
  const job = await dlq.add(
    `dlq-${opts.reason}`,
    { originalData: data, ...opts, sourceQueue: source, movedAt: new Date().toISOString() },
    { removeOnComplete: false, removeOnFail: false } as JobsOptions,
  );
  incCounter('queue_dlq_enqueued_total', 'Jobs moved to DLQ', 1, { source, reason: opts.reason });
  log.warn({ source, jobId: job.id, reason: opts.reason }, 'job moved to DLQ');
  return job.id ?? '';
}

export async function listDLQ(source: QueueName, start = 0, end = 100): Promise<unknown[]> {
  const dlq = getDLQ(source);
  const jobs = await dlq.getJobs(['waiting', 'active', 'completed', 'failed'], start, end);
  return jobs.map((j) => ({
    id: j.id,
    name: j.name,
    data: j.data,
    timestamp: j.timestamp,
  }));
}

export async function getDLQCounts(source: QueueName): Promise<{ waiting: number; completed: number; failed: number }> {
  const dlq = getDLQ(source);
  const [waiting, completed, failed] = await Promise.all([
    dlq.getWaitingCount(),
    dlq.getCompletedCount(),
    dlq.getFailedCount(),
  ]);
  return { waiting, completed, failed };
}

export async function purgeDLQ(source: QueueName): Promise<void> {
  const dlq = getDLQ(source);
  await dlq.drain(true);
  incCounter('queue_dlq_purged_total', 'DLQ purged', 1, { source });
}

export async function closeAllDLQs(): Promise<void> {
  for (const q of dlqCache.values()) {
    try { await q.close(); } catch {}
  }
  dlqCache.clear();
}
