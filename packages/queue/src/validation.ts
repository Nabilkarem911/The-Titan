import { z, type ZodType } from 'zod';
import { type QueueName, QUEUE_NAMES } from '@titan/shared';
import { incCounter, getAbuseDetector } from '@titan/observability';
import { getLogger } from '@titan/logging';
import { ToolInputSchema } from '@titan/shared';

const log = getLogger().child({ component: 'queue-validation' });

export class JobValidationError extends Error {
  readonly code = 'JOB_VALIDATION_FAILED';
  readonly issues: z.ZodIssue[];
  constructor(issues: z.ZodIssue[]) {
    super(`Job validation failed: ${issues.length} issue(s)`);
    this.name = 'JobValidationError';
    this.issues = issues;
  }
}

export class RetryableError extends Error {
  readonly code = 'RETRYABLE';
  readonly retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'RetryableError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class NonRetryableError extends Error {
  readonly code = 'NON_RETRYABLE';
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof NonRetryableError) return false;
  if (err instanceof RetryableError) return true;
  if (err instanceof JobValidationError) return false;
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (code === 'NON_RETRYABLE') return false;
    if (code === 'RETRYABLE') return true;
  }
  return true;
}

const schemas = new Map<QueueName, ZodType<unknown>>();

export function registerJobSchema<T>(queue: QueueName, schema: ZodType<T>): void {
  schemas.set(queue, schema as ZodType<unknown>);
  log.info({ queue }, 'job schema registered');
}

export function getJobSchema(queue: QueueName): ZodType<unknown> | undefined {
  return schemas.get(queue);
}

export function listRegisteredSchemas(): QueueName[] {
  return Array.from(schemas.keys());
}

export function validateJob<T>(queue: QueueName, data: unknown): T {
  const schema = schemas.get(queue);
  if (!schema) {
    throw new NonRetryableError(`No schema registered for queue ${queue}`);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    incCounter('queue_validation_failures_total', 'Queue job validation failures', 1, { queue });
    throw new JobValidationError(parsed.error.issues);
  }
  return parsed.data as T;
}

export function registerToolSchemas(): void {
  registerJobSchema(QUEUE_NAMES.TOOL_EXECUTE, ToolInputSchema as any);
  log.info({ queue: QUEUE_NAMES.TOOL_EXECUTE }, 'tool schemas registered');
}

export const KNOWN_QUEUE_NAMES = Object.values(QUEUE_NAMES);

export function isKnownQueue(name: string): name is QueueName {
  return (KNOWN_QUEUE_NAMES as string[]).includes(name);
}

export function checkPoison(jobId: string, attempts: number, threshold: number): boolean {
  if (attempts >= threshold) {
    incCounter('queue_poison_detected_total', 'Poison jobs detected', 1);
    getAbuseDetector().record({ signal: 'queue_poison', subject: `job:${jobId}`, metadata: { attempts } });
    log.warn({ jobId, attempts, threshold }, 'poison job detected');
    return true;
  }
  return false;
}
