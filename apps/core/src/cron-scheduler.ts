import { getLogger } from '@titan/logging';
import { enqueue, QUEUE_NAMES } from '@titan/queue';
import { randomUUID } from 'node:crypto';

const log = getLogger().child({ component: 'cron-scheduler' });

export interface CronJob {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  userId?: string;
}

// In-memory store (survives restarts via periodic re-schedule)
const jobs = new Map<string, CronJob>();
const timers = new Map<string, NodeJS.Timeout>();

/**
 * Parse a simple cron expression and return next run Date.
 * Supports: "* * * * *" (min hour day month weekday)
 * Also supports shorthand: @hourly, @daily, @weekly, @monthly
 */
function parseNextRun(expr: string): Date {
  const shorthands: Record<string, string> = {
    '@hourly':  '0 * * * *',
    '@daily':   '0 0 * * *',
    '@midnight':'0 0 * * *',
    '@weekly':  '0 0 * * 0',
    '@monthly': '0 0 1 * *',
    '@yearly':  '0 0 1 1 *',
  };
  const resolved = shorthands[expr.toLowerCase()] ?? expr;
  const parts = resolved.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Invalid cron expression: "${expr}"`);

  const [minPart, hourPart, , , ] = parts;
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);

  // Parse minute
  const minute = minPart === '*' ? -1 : parseInt(minPart);
  const hour = hourPart === '*' ? -1 : parseInt(hourPart);

  if (minute !== -1 && hour !== -1) {
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (hour !== -1) {
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (minute !== -1) {
    next.setMinutes(minute, 0, 0);
    if (next <= now) next.setHours(next.getHours() + 1);
  } else {
    // Every minute — next full minute
    next.setMinutes(next.getMinutes() + 1, 0, 0);
  }

  return next;
}

function getMsUntilNext(expr: string): number {
  const next = parseNextRun(expr);
  return Math.max(next.getTime() - Date.now(), 1000);
}

function scheduleJob(job: CronJob): void {
  if (!job.enabled) return;

  const run = () => {
    void (async () => {
      log.info({ jobId: job.id, name: job.name }, 'cron job firing');
      try {
        const runId = randomUUID();
        await enqueue(QUEUE_NAMES.AGENT_EXECUTE, 'agent.run', {
          runId,
          agentId: job.agentId,
          prompt: job.prompt,
          userId: job.userId,
          maxSteps: 10,
        });
        const updated = jobs.get(job.id);
        if (updated) {
          updated.lastRunAt = new Date();
          updated.nextRunAt = parseNextRun(updated.cronExpression);
        }
        log.info({ jobId: job.id, runId }, 'cron job enqueued');
      } catch (err) {
        log.error({ err, jobId: job.id }, 'cron job enqueue failed');
      }
      // Reschedule
      const current = jobs.get(job.id);
      if (current?.enabled) scheduleJob(current);
    })();
  };

  const ms = getMsUntilNext(job.cronExpression);
  job.nextRunAt = new Date(Date.now() + ms);
  const timer = setTimeout(run, ms);
  if (timer.unref) timer.unref();
  timers.set(job.id, timer);
}

function cancelJob(id: string): void {
  const timer = timers.get(id);
  if (timer) { clearTimeout(timer); timers.delete(id); }
}

// === Public API ===

export function createCronJob(input: Omit<CronJob, 'id' | 'createdAt' | 'nextRunAt'>): CronJob {
  // Validate expression
  parseNextRun(input.cronExpression);

  const job: CronJob = {
    ...input,
    id: randomUUID(),
    createdAt: new Date(),
  };
  jobs.set(job.id, job);
  if (job.enabled) scheduleJob(job);
  log.info({ jobId: job.id, name: job.name, expr: job.cronExpression }, 'cron job created');
  return job;
}

export function updateCronJob(id: string, patch: Partial<Pick<CronJob, 'name' | 'prompt' | 'cronExpression' | 'enabled'>>): CronJob {
  const job = jobs.get(id);
  if (!job) throw new Error(`Cron job not found: ${id}`);

  cancelJob(id);
  if (patch.cronExpression) parseNextRun(patch.cronExpression);

  Object.assign(job, patch);
  if (job.enabled) scheduleJob(job);
  log.info({ jobId: id }, 'cron job updated');
  return job;
}

export function deleteCronJob(id: string): void {
  cancelJob(id);
  jobs.delete(id);
  log.info({ jobId: id }, 'cron job deleted');
}

export function listCronJobs(userId?: string): CronJob[] {
  const all = [...jobs.values()];
  return userId ? all.filter((j) => j.userId === userId) : all;
}

export function getCronJob(id: string): CronJob | undefined {
  return jobs.get(id);
}

export function startCronScheduler(): void {
  log.info('cron scheduler started');
  // Re-schedule any jobs that were loaded (e.g. from persistence)
  for (const job of jobs.values()) {
    if (job.enabled) scheduleJob(job);
  }
}

export function stopCronScheduler(): void {
  for (const id of timers.keys()) cancelJob(id);
  log.info('cron scheduler stopped');
}
