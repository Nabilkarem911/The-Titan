import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { query } from './client.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'user-memory' });

function getEncKey(): Buffer {
  const raw = process.env['API_KEY_ENCRYPTION_KEY'] ?? '';
  if (raw.length < 32) throw new Error('API_KEY_ENCRYPTION_KEY too short for secret encryption');
  return Buffer.from(raw.slice(0, 64), 'hex');
}

function encrypt(plaintext: string): string {
  const key = getEncKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(encoded: string): string {
  const key = getEncKey();
  const [ivHex, tagHex, encHex] = encoded.split(':');
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid encrypted value format');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final('utf8');
}

export const userSecrets = {
  async set(ownerId: string, key: string, value: string, description?: string): Promise<void> {
    const valueEnc = encrypt(value);
    await query(
      `INSERT INTO user_secrets (owner_id, key, value_enc, description, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (owner_id, key) DO UPDATE
         SET value_enc = EXCLUDED.value_enc,
             description = COALESCE(EXCLUDED.description, user_secrets.description),
             updated_at = now()`,
      [ownerId, key, valueEnc, description ?? null],
    );
    log.info({ ownerId, key }, 'secret stored');
  },

  async get(ownerId: string, key: string): Promise<string | null> {
    const r = await query<{ value_enc: string }>(
      `SELECT value_enc FROM user_secrets WHERE owner_id = $1 AND key = $2`,
      [ownerId, key],
    );
    if (!r.rows[0]) return null;
    try {
      return decrypt(r.rows[0].value_enc);
    } catch (err) {
      log.error({ ownerId, key, err }, 'failed to decrypt secret');
      return null;
    }
  },

  async list(ownerId: string): Promise<Array<{ key: string; description: string | null; updatedAt: Date }>> {
    const r = await query<{ key: string; description: string | null; updated_at: string }>(
      `SELECT key, description, updated_at FROM user_secrets WHERE owner_id = $1 ORDER BY key`,
      [ownerId],
    );
    return r.rows.map((row) => ({ key: row.key, description: row.description, updatedAt: new Date(row.updated_at) }));
  },

  async delete(ownerId: string, key: string): Promise<void> {
    await query(`DELETE FROM user_secrets WHERE owner_id = $1 AND key = $2`, [ownerId, key]);
    log.info({ ownerId, key }, 'secret deleted');
  },
};

export const userContext = {
  async set(ownerId: string, key: string, value: string): Promise<void> {
    await query(
      `INSERT INTO user_context (owner_id, key, value, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (owner_id, key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = now()`,
      [ownerId, key, value],
    );
    log.info({ ownerId, key }, 'context stored');
  },

  async get(ownerId: string, key: string): Promise<string | null> {
    const r = await query<{ value: string }>(
      `SELECT value FROM user_context WHERE owner_id = $1 AND key = $2`,
      [ownerId, key],
    );
    return r.rows[0]?.value ?? null;
  },

  async getAll(ownerId: string): Promise<Record<string, string>> {
    const r = await query<{ key: string; value: string }>(
      `SELECT key, value FROM user_context WHERE owner_id = $1 ORDER BY key`,
      [ownerId],
    );
    return Object.fromEntries(r.rows.map((row) => [row.key, row.value]));
  },

  async delete(ownerId: string, key: string): Promise<void> {
    await query(`DELETE FROM user_context WHERE owner_id = $1 AND key = $2`, [ownerId, key]);
  },
};

export async function getChatHistory(sessionId: string, limit = 50): Promise<Array<{ role: string; content: string }>> {
  const r = await query<{ role: string; content: string }>(
    `SELECT role, content FROM memory_messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, limit],
  );
  return r.rows.reverse();
}

export async function saveChatMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  await query(
    `INSERT INTO memory_messages (session_id, role, content) VALUES ($1, $2, $3)`,
    [sessionId, role, content],
  );
}
