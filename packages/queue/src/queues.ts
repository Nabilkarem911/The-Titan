import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { getLogger } from '@titan/logging';
import { loadConfig } from '@titan/config';
import { QUEUE_NAMES, type QueueName } from '@titan/shared';
import { getRedis } from './client.js';

const queues = new Map<QueueName, Queue>();
let initialized = false;

function baseConnection(): ConnectionOptions {
  const c = loadConfig();
  return {
    host: c.REDIS_HOST,
    port: c.REDIS_PORT,
    password: c.REDIS_PASSWORD || undefined,
    db: c.REDIS_DB,
    tls: c.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

function defaultJobOptions(): JobsOptions {
  const c = loadConfig();
  return {
    priority: c.QUEUE_DEFAULT_PRIORITY,
    removeOnComplete: { count: c.QUEUE_REMOVE_ON_COMPLETE },
    removeOnFail: { count: c.QUEUE_REMOVE_ON_FAIL },
    attempts: c.QUEUE_ATTEMPTS_DEFAULT,
    backoff: { type: 'exponential', delay: c.QUEUE_BACKOFF_MS },
  };
}

const PER_QUEUE_DEFAULTS: Record<QueueName, Partial<JobsOptions>> = {
  [QUEUE_NAMES.AGENT_EXECUTE]: { priority: 7, attempts: 5 },
  [QUEUE_NAMES.TOOL_EXECUTE]: { priority: 7, attempts: 3 },
  [QUEUE_NAMES.MEMORY_INDEX]: { priority: 5, attempts: 3 },
  [QUEUE_NAMES.MEMORY_RETRIEVE]: { priority: 5, attempts: 2 },
  [QUEUE_NAMES.SANDBOX_EXEC]: { priority: 7, attempts: 2 },
  [QUEUE_NAMES.MONITORING_CHECK]: { priority: 2, attempts: 5 },
  [QUEUE_NAMES.AUDIT_WRITE]: { priority: 10, attempts: 5, removeOnComplete: true },
  [QUEUE_NAMES.WEBHOOK_DELIVER]: { priority: 5, attempts: 10, backoff: { type: 'exponential', delay: 5_000 } },
  [QUEUE_NAMES.SWARM_EXECUTE]: { priority: 7, attempts: 3 },
};

function buildOptions(queueName: QueueName) {
  return {
    connection: baseConnection(),
    prefix: loadConfig().REDIS_KEY_PREFIX,
    defaultJobOptions: { ...defaultJobOptions(), ...PER_QUEUE_DEFAULTS[queueName] },
  };
}

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, buildOptions(name));
    const log = getLogger().child({ component: 'queue', queue: name });
    q.on('error', (err) => log.error({ err }, 'queue error'));
    queues.set(name, q);
  }
  return q;
}

export async function initializeQueues(): Promise<void> {
  if (initialized) return;
  const log = getLogger().child({ component: 'queue' });
  await getRedis().ping();
  for (const name of Object.values(QUEUE_NAMES)) {
    getQueue(name);
  }
  log.info({ queues: Object.values(QUEUE_NAMES) }, 'queue topology initialized');
  initialized = true;
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all(Array.from(queues.values()).map((q) => q.close()));
  queues.clear();
  initialized = false;
}

export async function enqueue<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  opts?: JobsOptions,
): Promise<string> {
  const job = await getQueue(queueName).add(jobName, data, opts);
  return job.id ?? '';
}

export async function drainQueue(queueName: QueueName): Promise<void> {
  await getQueue(queueName).drain(true);
}

export async function getQueueStats(queueName: QueueName): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const q = getQueue(queueName);
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
    q.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
