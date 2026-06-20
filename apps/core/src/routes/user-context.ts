import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { userContext } from '@titan/database';
import { requireAuth } from '../plugins/auth.js';

const SetContextSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(10_000),
});

export const userContextRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // GET /api/v1/user-context — list all context items for current user
  app.get('/api/v1/user-context', async (req) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const ctx = await userContext.getAll(userId);
    const items = Object.entries(ctx).map(([key, value]) => ({ key, value }));
    return { items, total: items.length };
  });

  // POST /api/v1/user-context — set a context key
  app.post('/api/v1/user-context', async (req) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const { key, value } = SetContextSchema.parse(req.body);
    await userContext.set(userId, key, value);
    return { key, value };
  });

  // DELETE /api/v1/user-context/:key — delete a context key
  app.delete<{ Params: { key: string } }>('/api/v1/user-context/:key', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    await userContext.delete(userId, req.params.key);
    return reply.status(204).send();
  });
};
