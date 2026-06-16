import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '@titan/shared';
import { requireAuth } from '../plugins/auth.js';
import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  listWebhooks,
  getWebhook,
  rotateWebhookSecret,
  verifyWebhookSignature,
  triggerWebhook,
  getWebhookDeliveries,
} from '../webhook-registry.js';

const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  agentId: z.string().min(1),
  promptTemplate: z.string().min(1).max(10_000),
  enabled: z.boolean().optional().default(true),
  events: z.array(z.string()).optional().default(['*']),
});

const UpdateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  promptTemplate: z.string().min(1).max(10_000).optional(),
  enabled: z.boolean().optional(),
  events: z.array(z.string()).optional(),
});

const serializeWebhook = (w: { id: string; name: string; agentId: string; secret: string; promptTemplate: string; enabled: boolean; events: string[]; triggerCount: number; lastTriggeredAt?: Date; createdAt: Date } | undefined | null, includeSecret = false) => w ? ({
  id: w.id,
  name: w.name,
  agentId: w.agentId,
  promptTemplate: w.promptTemplate,
  enabled: w.enabled,
  events: w.events,
  triggerCount: w.triggerCount,
  lastTriggeredAt: w.lastTriggeredAt?.toISOString() ?? null,
  createdAt: w.createdAt.toISOString(),
  ...(includeSecret ? { secret: w.secret } : {}),
  webhookUrl: `/api/v1/webhooks/${w.id}/trigger`,
}) : null;

export const webhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/webhooks — list all webhooks for current user
  app.get('/api/v1/webhooks', { preHandler: requireAuth }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const webhooks = await listWebhooks(req.auth.userId);
    return { items: webhooks.map((w) => serializeWebhook(w)), total: webhooks.length };
  });

  // POST /api/v1/webhooks — create a new webhook
  app.post('/api/v1/webhooks', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const input = CreateWebhookSchema.parse(req.body);
    const wh = await createWebhook({ ...input, userId: req.auth.userId });
    // Return secret only on creation
    return reply.status(201).send(serializeWebhook(wh, true));
  });

  // GET /api/v1/webhooks/:id — get webhook details
  app.get<{ Params: { id: string } }>('/api/v1/webhooks/:id', { preHandler: requireAuth }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const wh = await getWebhook(req.params.id);
    if (!wh || wh.userId !== req.auth.userId) throw new ValidationError('Webhook not found');
    return serializeWebhook(wh);
  });

  // PATCH /api/v1/webhooks/:id — update webhook
  app.patch<{ Params: { id: string } }>('/api/v1/webhooks/:id', { preHandler: requireAuth }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const existing = await getWebhook(req.params.id);
    if (!existing || existing.userId !== req.auth.userId) throw new ValidationError('Webhook not found');
    const patch = UpdateWebhookSchema.parse(req.body);
    const updated = await updateWebhook(req.params.id, patch);
    return serializeWebhook(updated);
  });

  // POST /api/v1/webhooks/:id/rotate-secret — rotate signing secret
  app.post<{ Params: { id: string } }>('/api/v1/webhooks/:id/rotate-secret', { preHandler: requireAuth }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const existing = await getWebhook(req.params.id);
    if (!existing || existing.userId !== req.auth.userId) throw new ValidationError('Webhook not found');
    const updated = await rotateWebhookSecret(req.params.id);
    return serializeWebhook(updated, true);
  });

  // GET /api/v1/webhooks/:id/deliveries — recent delivery log
  app.get<{ Params: { id: string } }>('/api/v1/webhooks/:id/deliveries', { preHandler: requireAuth }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const existing = await getWebhook(req.params.id);
    if (!existing || existing.userId !== req.auth.userId) throw new ValidationError('Webhook not found');
    const deliveries = getWebhookDeliveries(req.params.id);
    return {
      items: deliveries.map((d) => ({
        webhookId: d.webhookId,
        runId: d.runId,
        status: d.status,
        error: d.error ?? null,
        deliveredAt: d.deliveredAt.toISOString(),
      })),
      total: deliveries.length,
    };
  });

  // DELETE /api/v1/webhooks/:id — delete webhook
  app.delete<{ Params: { id: string } }>('/api/v1/webhooks/:id', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const existing = await getWebhook(req.params.id);
    if (!existing || existing.userId !== req.auth.userId) throw new ValidationError('Webhook not found');
    await deleteWebhook(req.params.id);
    return reply.status(204).send();
  });

  // POST /api/v1/webhooks/:id/trigger — public endpoint (no auth, HMAC verification)
  app.post<{ Params: { id: string } }>(
    '/api/v1/webhooks/:id/trigger',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const wh = await getWebhook(req.params.id);
      if (!wh || !wh.enabled) {
        return reply.status(404).send({ error: 'Webhook not found or disabled' });
      }

      // Verify HMAC signature (mandatory)
      const signature = req.headers['x-titan-signature'] ?? req.headers['x-hub-signature-256'];
      if (!signature) {
        return reply.status(401).send({ error: 'Missing webhook signature header (X-Titan-Signature or X-Hub-Signature-256)' });
      }
      const rawBody = JSON.stringify(req.body);
      const valid = verifyWebhookSignature(wh.secret, rawBody, String(signature));
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid webhook signature' });
      }

      const payload = (req.body ?? {}) as Record<string, unknown>;

      try {
        const { runId } = await triggerWebhook(wh.id, payload);
        return reply.status(202).send({ received: true, runId });
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message });
      }
    },
  );
};
