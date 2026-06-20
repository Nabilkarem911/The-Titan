import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { userContext, getChatHistory, saveChatMessage } from '@titan/database';
import { requireAuth } from '../plugins/auth.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'user-context-routes' });

const SetContextSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(10_000),
});

const LinkTelegramSchema = z.object({
  telegramId: z.string().min(1).max(50),
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

  // POST /api/v1/user-context/link-telegram — link telegram account and merge memory + chat history
  app.post('/api/v1/user-context/link-telegram', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const { telegramId } = LinkTelegramSchema.parse(req.body);

    try {
      // Save the link
      await userContext.set(userId, 'telegram_id', telegramId);

      // Merge memory: copy all keys from telegram user to dashboard user (don't overwrite existing)
      const tgCtx = await userContext.getAll(telegramId);
      const dashCtx = await userContext.getAll(userId);
      let mergedCount = 0;
      for (const [key, value] of Object.entries(tgCtx)) {
        if (key === 'telegram_id') continue;
        if (!(key in dashCtx)) {
          await userContext.set(userId, key, value);
          mergedCount++;
        }
      }

      // Merge chat history: copy telegram messages to dashboard session
      const tgSessionId = `tg:${telegramId}`;
      const dashSessionId = `session:${userId}:default-agent`;
      const tgHistory = await getChatHistory(tgSessionId, 200);
      let historyMerged = 0;
      for (const msg of tgHistory) {
        await saveChatMessage(dashSessionId, msg.role as 'user' | 'assistant', msg.content);
        historyMerged++;
      }

      log.info({ userId, telegramId, mergedCount, historyMerged }, 'telegram account linked and merged');

      return {
        linked: true,
        telegramId,
        memoryMerged: mergedCount,
        historyMerged,
      };
    } catch (err) {
      log.error({ err, userId, telegramId }, 'failed to link telegram');
      return reply.status(500).send({ error: 'Failed to link Telegram account' });
    }
  });

  // GET /api/v1/user-context/telegram-status — check if telegram is linked
  app.get('/api/v1/user-context/telegram-status', async (req) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const ctx = await userContext.getAll(userId);
    const telegramId = ctx['telegram_id'] ?? null;
    return { linked: !!telegramId, telegramId };
  });
};
