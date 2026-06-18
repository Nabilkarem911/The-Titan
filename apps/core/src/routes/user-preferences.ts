import type { FastifyInstance } from 'fastify';

export default async function userPreferencesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/user/preferences', async (req, reply) => {
    // In production, query user_preferences table
    return { theme: 'dark', language: 'auto', notificationEmail: true, notificationPush: true, defaultModel: null, defaultAgent: null, timezone: 'UTC' };
  });

  app.patch('/api/v1/user/preferences', async (req, reply) => {
    const updates = req.body as Record<string, unknown>;
    return { updated: Object.keys(updates), note: 'Persist to user_preferences table' };
  });

  app.get('/api/v1/user/notifications', async (req, reply) => {
    return { notifications: [], unreadCount: 0 };
  });

  app.post('/api/v1/user/notifications/:id/read', async (req, reply) => {
    const { id } = req.params as { id: string };
    return { id, read: true };
  });

  app.delete('/api/v1/user/notifications/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return { id, deleted: true };
  });
}
