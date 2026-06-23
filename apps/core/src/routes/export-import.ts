import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { query } from '@titan/database';

export const exportImportRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/api/v1/export/profiles', { preHandler: [requireAuth] }, async (_req, reply) => {
    const result = await query(`SELECT * FROM agent_profiles ORDER BY created_at DESC`);
    return reply.send({ format: 'json', profiles: result.rows });
  });

  app.post('/api/v1/import/profiles', { preHandler: [requireAuth] }, async (req, reply) => {
    const { profiles } = req.body as { profiles: Array<Record<string, unknown>> };
    let imported = 0;
    for (const p of profiles) {
      await query(
        `INSERT INTO agent_profiles (name, description, system_prompt, model, temperature, max_tokens, tools, capabilities)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (name) DO UPDATE SET system_prompt = $3, updated_at = now()`,
        [p.name, p.description ?? null, p.system_prompt ?? p.systemPrompt ?? '', p.model ?? null, p.temperature ?? 0.7, p.max_tokens ?? p.maxTokens ?? 2000, p.tools ?? [], p.capabilities ?? []],
      );
      imported++;
    }
    return reply.send({ imported });
  });

  app.post('/api/v1/export/conversations', { preHandler: [requireAuth] }, async (req, reply) => {
    const { sessionId, format } = req.body as { sessionId?: string; format?: string };
    if (sessionId) {
      const result = await query(`SELECT * FROM memory_messages WHERE session_id = $1 ORDER BY created_at ASC`, [sessionId]);
      return reply.send({ format: format ?? 'json', messages: result.rows });
    }
    const result = await query(`SELECT * FROM memory_messages ORDER BY created_at DESC LIMIT 1000`);
    return reply.send({ format: format ?? 'json', messages: result.rows });
  });

  app.post('/api/v1/export/workspace', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.auth?.userId;
    const profiles = await query(`SELECT * FROM agent_profiles ORDER BY created_at DESC`);
    const runs = await query(`SELECT * FROM agent_runs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500`, [userId]);
    const messages = await query(`SELECT * FROM memory_messages ORDER BY created_at DESC LIMIT 1000`);
    return reply.send({ status: 'completed', profiles: profiles.rows, runs: runs.rows, messages: messages.rows });
  });

  app.post('/api/v1/import/tools', { preHandler: [requireAuth] }, async (req, reply) => {
    const { tools } = req.body as { tools: Array<Record<string, unknown>> };
    let imported = 0;
    for (const t of tools) {
      await query(
        `INSERT INTO plugins (name, description, source, status, capabilities) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (name) DO UPDATE SET description = $2, updated_at = now()`,
        [t.name, t.description ?? '', t.source ?? 'local', t.status ?? 'enabled', t.capabilities ?? []],
      );
      imported++;
    }
    return reply.send({ imported });
  });
};
