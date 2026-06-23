import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { query } from '@titan/database';

export const searchRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/api/v1/search/code', { preHandler: [requireAuth] }, async (req, reply) => {
    const { query: q, limit } = req.body as { query: string; limit?: number };
    if (!q) return reply.code(400).send({ error: 'query required' });
    const result = await query(
      `SELECT * FROM code_symbols WHERE name ILIKE $1 OR type ILIKE $1 ORDER BY name LIMIT $2`,
      [`%${q}%`, limit ?? 20],
    );
    return reply.send({ results: result.rows, total: result.rows.length, query: q });
  });

  app.post('/api/v1/search/runs', { preHandler: [requireAuth] }, async (req, reply) => {
    const { query: q, status, agentId, from, to } = req.body as { query?: string; status?: string; agentId?: string; from?: string; to?: string };
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (q) { params.push(`%${q}%`); conditions.push(`prompt ILIKE $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (agentId) { params.push(agentId); conditions.push(`agent_id = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`created_at >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`created_at <= $${params.length}`); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`SELECT * FROM agent_runs ${where} ORDER BY created_at DESC LIMIT 50`, params);
    return reply.send({ results: result.rows, total: result.rows.length, filters: { query: q, status, agentId, from, to } });
  });

  app.post('/api/v1/search/memory', { preHandler: [requireAuth] }, async (req, reply) => {
    const { query: q, collection, limit } = req.body as { query: string; collection?: string; limit?: number };
    if (!q) return reply.code(400).send({ error: 'query required' });
    const result = await query(
      `SELECT * FROM memory_messages WHERE content ILIKE $1 ORDER BY created_at DESC LIMIT $2`,
      [`%${q}%`, limit ?? 20],
    );
    return reply.send({ results: result.rows, total: result.rows.length, query: q, collection: collection ?? 'global' });
  });

  app.post('/api/v1/search/docs', { preHandler: [requireAuth] }, async (req, reply) => {
    const { query: q, limit } = req.body as { query: string; limit?: number };
    if (!q) return reply.code(400).send({ error: 'query required' });
    const result = await query(
      `SELECT * FROM knowledge_documents WHERE title ILIKE $1 OR content ILIKE $1 ORDER BY created_at DESC LIMIT $2`,
      [`%${q}%`, limit ?? 20],
    );
    return reply.send({ results: result.rows, citations: [], total: result.rows.length, query: q });
  });

  app.post('/api/v1/search/tools', { preHandler: [requireAuth] }, async (req, reply) => {
    const { query: q, category } = req.body as { query: string; category?: string };
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (q) { params.push(`%${q}%`); conditions.push(`name ILIKE $${params.length}`); }
    if (category) { params.push(category); conditions.push(`source = $${params.length}`); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`SELECT * FROM plugins ${where} ORDER BY name LIMIT 50`, params);
    return reply.send({ results: result.rows, total: result.rows.length, query: q });
  });
};
