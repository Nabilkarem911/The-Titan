import { Worker, type Job, type ConnectionOptions, type Processor } from 'bullmq';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { type QueueName } from '@titan/shared';
import {
  validateJob,
  JobValidationError,
  NonRetryableError,
  checkPoison,
} from './validation.js';
import { moveToDLQ } from './dlq.js';
import { incCounter, observeHistogram } from '@titan/observability';

export interface WorkerOptions<TData = unknown, TResult = unknown> {
  queueName: QueueName;
  processor: Processor<TData, TResult>;
  concurrency?: number;
  jobName?: string;
  enableValidation?: boolean;
  enableDLQ?: boolean;
  poisonThreshold?: number;
}

export interface TitanWorker<TData = unknown, TResult = unknown> {
  worker: Worker<TData, TResult>;
  close: () => Promise<void>;
}

export function createWorker<TData, TResult>(
  options: WorkerOptions<TData, TResult>,
): TitanWorker<TData, TResult> {
  const c = loadConfig();
  const log = getLogger().child({ component: 'worker', queue: options.queueName });
  const enableValidation = options.enableValidation ?? true;
  const enableDLQ = options.enableDLQ ?? true;
  const poisonThreshold = options.poisonThreshold ?? c.QUEUE_POISON_THRESHOLD;
  const connection: ConnectionOptions = {
    host: c.REDIS_HOST,
    port: c.REDIS_PORT,
    password: c.REDIS_PASSWORD || undefined,
    db: c.REDIS_DB,
    keyPrefix: c.REDIS_KEY_PREFIX,
    tls: c.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };

  const wrappedProcessor: Processor<TData, TResult> = async (job: Job<TData>) => {
    if (options.jobName && job.name !== options.jobName) return undefined as unknown as TResult;
    const start = Date.now();
    log.info({ jobId: job.id, jobName: job.name, attempt: job.attemptsMade + 1 }, 'job started');
    if (enableValidation) {
      try {
        validateJob(options.queueName, job.data);
      } catch (err) {
        const duration = Date.now() - start;
        incCounter('queue_validation_rejections_total', 'Jobs rejected by validation', 1, { queue: options.queueName });
        observeHistogram('queue_job_duration_ms', 'Queue job handler duration', duration, [0.01, 0.1, 0.5, 1, 5, 10, 30]);
        log.warn({ jobId: job.id, err: (err as Error).message }, 'job failed validation');
        if (err instanceof JobValidationError) {
          if (enableDLQ && job.id) {
            try { await moveToDLQ(options.queueName, job.data, { source: options.queueName, reason: 'non_retryable', originalJobId: job.id, attemptsMade: job.attemptsMade + 1, failedReason: err.message }); } catch (dlqErr) { log.error({ err: dlqErr }, 'failed to move to DLQ'); }
          }
          throw new NonRetryableError(err.message);
        }
        throw err;
      }
    }
    try {
      const result = await options.processor(job);
      observeHistogram('queue_job_duration_ms', 'Queue job handler duration', Date.now() - start, [0.01, 0.1, 0.5, 1, 5, 10, 30]);
      log.info(
        { jobId: job.id, jobName: job.name, durationMs: Date.now() - start },
        'job completed',
      );
      return result;
    } catch (err) {
      const attempts = job.attemptsMade + 1;
      const isPoison = checkPoison(job.id ?? 'unknown', attempts, poisonThreshold);
      log.error(
        {
          err,
          jobId: job.id,
          jobName: job.name,
          attempt: attempts,
          durationMs: Date.now() - start,
          isPoison,
        },
        'job failed',
      );
      if (isPoison && enableDLQ) {
        try { await moveToDLQ(options.queueName, job.data, { source: options.queueName, reason: 'poison', originalJobId: job.id, attemptsMade: attempts, failedReason: (err as Error).message }); } catch (dlqErr) { log.error({ err: dlqErr }, 'failed to move to DLQ'); }
      }
      throw err;
    }
  };

  const worker = new Worker<TData, TResult>(options.queueName, wrappedProcessor, {
    connection,
    prefix: c.REDIS_KEY_PREFIX,
    concurrency: options.concurrency ?? 4,
    lockDuration: 30_000,
  });

  worker.on('error', (err) => log.error({ err }, 'worker error'));
  worker.on('ready', () => log.info('worker ready'));
  worker.on('closed', () => log.info('worker closed'));

  return {
    worker,
    close: async () => {
      await worker.close();
    },
  };
}
