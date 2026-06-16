import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
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

// In-memory store for MVP. In production, store in PostgreSQL with encryption.
const keyStore = new Map<string, StoredKey[]>();

function getEncryptionKey(): string {
  return process.env.ENCRYPTION_KEY ?? process.env.API_KEY_ENCRYPTION_KEY?.substring(0, 32) ?? 'titan-default-key-change-me-now!';
}

function encrypt(value: string): string {
  // Simple XOR-based obfuscation for MVP. Use AES-256-GCM in production.
  const key = getEncryptionKey();
  let result = '';
  for (let i = 0; i < value.length; i++) {
    result += String.fromCharCode(value.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result, 'binary').toString('base64');
}

function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const decoded = Buffer.from(encrypted, 'base64').toString('binary');
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

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
    const { name, provider, value } = req.body as { name: string; provider: string; value: string };

    if (!name || !provider || !value) {
      return reply.status(400).send({ error: 'name, provider, and value are required' });
    }

    const existing = keyStore.get(userId) ?? [];
    const newKey: StoredKey = {
      id: randomUUID(),
      userId,
      name,
      provider,
      encryptedValue: encrypt(value),
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

    return { value: decrypt(key.encryptedValue) };
  });
};
