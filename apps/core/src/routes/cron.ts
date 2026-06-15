import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '@titan/shared';
import { requireAuth } from '../plugins/auth.js';
import {
  createCronJob,
  updateCronJob,
  deleteCronJob,
  listCronJobs,
  getCronJob,
} from '../cron-scheduler.js';

const CreateCronSchema = z.object({
  name: z.string().min(1).max(100),
  agentId: z.string().min(1),
  prompt: z.string().min(1).max(10_000),
  cronExpression: z.string().min(1),
  enabled: z.boolean().optional().default(true),
});

const UpdateCronSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  prompt: z.string().min(1).max(10_000).optional(),
  cronExpression: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

const serializeJob = (j: ReturnType<typeof getCronJob>) => j ? ({
  id: j.id,
  name: j.name,
  agentId: j.agentId,
  prompt: j.prompt,
  cronExpression: j.cronExpression,
  enabled: j.enabled,
  lastRunAt: j.lastRunAt?.toISOString() ?? null,
  nextRunAt: j.nextRunAt?.toISOString() ?? null,
  createdAt: j.createdAt.toISOString(),
}) : null;

export const cronRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/cron — list all cron jobs for current user
  app.get('/api/v1/cron', { preHandler: requireAuth }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const jobs = listCronJobs(req.auth.userId);
    return { items: jobs.map(serializeJob), total: jobs.length };
  });

  // POST /api/v1/cron — create a new cron job
  app.post('/api/v1/cron', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const input = CreateCronSchema.parse(req.body);
    try {
      const job = createCronJob({ ...input, userId: req.auth.userId });
      return reply.status(201).send(serializeJob(job));
    } catch (err) {
      throw new ValidationError((err as Error).message);
    }
  });

  // GET /api/v1/cron/:id — get a specific cron job
  app.get<{ Params: { id: string } }>('/api/v1/cron/:id', { preHandler: requireAuth }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const job = getCronJob(req.params.id);
    if (!job || job.userId !== req.auth.userId) throw new ValidationError('Cron job not found');
    return serializeJob(job);
  });

  // PATCH /api/v1/cron/:id — update a cron job
  app.patch<{ Params: { id: string } }>('/api/v1/cron/:id', { preHandler: requireAuth }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const existing = getCronJob(req.params.id);
    if (!existing || existing.userId !== req.auth.userId) throw new ValidationError('Cron job not found');
    const patch = UpdateCronSchema.parse(req.body);
    try {
      const updated = updateCronJob(req.params.id, patch);
      return serializeJob(updated);
    } catch (err) {
      throw new ValidationError((err as Error).message);
    }
  });

  // DELETE /api/v1/cron/:id — delete a cron job
  app.delete<{ Params: { id: string } }>('/api/v1/cron/:id', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const existing = getCronJob(req.params.id);
    if (!existing || existing.userId !== req.auth.userId) throw new ValidationError('Cron job not found');
    deleteCronJob(req.params.id);
    return reply.status(204).send();
  });
};
