import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { userPreferences, userNotifications } from '@titan/database';

export const userPreferencesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/api/v1/user/preferences', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.auth!.userId;
    const prefs = await userPreferences.getOrCreate(userId);
    return reply.send(prefs);
  });

  app.patch('/api/v1/user/preferences', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.auth!.userId;
    const updates = req.body as Record<string, unknown>;
    const updated = await userPreferences.update(userId, updates);
    return reply.send(updated);
  });

  app.get('/api/v1/user/notifications', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.auth!.userId;
    const result = await userNotifications.getByUser(userId);
    return reply.send(result);
  });

  app.post('/api/v1/user/notifications/:id/read', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await userNotifications.markRead(id);
    return reply.send({ id, read: true });
  });

  app.delete('/api/v1/user/notifications/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await userNotifications.delete(id);
    return reply.send({ id, deleted: true });
  });
};
