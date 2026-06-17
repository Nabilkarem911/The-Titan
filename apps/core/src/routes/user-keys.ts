import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import { encryptToJson, decryptFromJson } from '@titan/auth';
import { requireAuth } from '../plugins/auth.js';

const log = getLogger().child({ component: 'user-keys-routes' });

interface StoredKey {
  id: string;
  userId: string;
  name: string;
  provider: string;
  encryptedValue: string;
  maskedValue: string;
  createdAt: string;
}

const AddKeyInputSchema = z.object({
  name: z.string().min(1).max(200),
  provider: z.string().min(1).max(100),
  value: z.string().min(1).max(10_000),
});

const keyStore = new Map<string, StoredKey[]>();

function maskValue(value: string): string {
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

export const userKeyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // List user keys
  app.get('/api/v1/user/keys', async (req) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const keys = keyStore.get(userId) ?? [];
    return {
      items: keys.map((k) => ({
        id: k.id,
        name: k.name,
        provider: k.provider,
        maskedValue: k.maskedValue,
        createdAt: k.createdAt,
      })),
    };
  });

  // Add a key
  app.post('/api/v1/user/keys', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const { name, provider, value } = AddKeyInputSchema.parse(req.body);

    const existing = keyStore.get(userId) ?? [];
    const newKey: StoredKey = {
      id: randomUUID(),
      userId,
      name,
      provider,
      encryptedValue: encryptToJson(value),
      maskedValue: maskValue(value),
      createdAt: new Date().toISOString(),
    };

    existing.push(newKey);
    keyStore.set(userId, existing);
    log.info({ userId, keyId: newKey.id, provider }, 'user key stored');

    return {
      id: newKey.id,
      name: newKey.name,
      provider: newKey.provider,
      maskedValue: newKey.maskedValue,
      createdAt: newKey.createdAt,
    };
  });

  // Delete a key
  app.delete('/api/v1/user/keys/:keyId', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const { keyId } = req.params as { keyId: string };
    const existing = keyStore.get(userId) ?? [];
    const idx = existing.findIndex((k) => k.id === keyId);

    if (idx === -1) {
      return reply.status(404).send({ error: 'Key not found' });
    }

    existing.splice(idx, 1);
    keyStore.set(userId, existing);
    log.info({ userId, keyId }, 'user key deleted');
    return { success: true };
  });

  // Get decrypted key value (for internal agent use)
  app.get('/api/v1/user/keys/:keyId/value', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const { keyId } = req.params as { keyId: string };
    const existing = keyStore.get(userId) ?? [];
    const key = existing.find((k) => k.id === keyId);

    if (!key) {
      return reply.status(404).send({ error: 'Key not found' });
    }

    return { value: decryptFromJson(key.encryptedValue) };
  });
};
