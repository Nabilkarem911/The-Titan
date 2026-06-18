import type { FastifyInstance } from 'fastify';

export default async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/search/code', async (req, reply) => {
    const { query, workspace, limit } = req.body as { query: string; workspace?: string; limit?: number };
    if (!query) return reply.status(400).send({ error: 'query required' });
    return { results: [], total: 0, query, note: 'Uses code-intel semantic search' };
  });

  app.post('/api/v1/search/runs', async (req, reply) => {
    const { query, status, agentId, from, to } = req.body as { query?: string; status?: string; agentId?: string; from?: string; to?: string };
    return { results: [], total: 0, filters: { query, status, agentId, from, to } };
  });

  app.post('/api/v1/search/memory', async (req, reply) => {
    const { query, collection, limit } = req.body as { query: string; collection?: string; limit?: number };
    if (!query) return reply.status(400).send({ error: 'query required' });
    return { results: [], total: 0, query, collection: collection ?? 'global' };
  });

  app.post('/api/v1/search/docs', async (req, reply) => {
    const { query, limit } = req.body as { query: string; limit?: number };
    if (!query) return reply.status(400).send({ error: 'query required' });
    return { results: [], citations: [], total: 0, note: 'Uses RAG pipeline' };
  });

  app.post('/api/v1/search/tools', async (req, reply) => {
    const { query, category } = req.body as { query: string; category?: string };
    return { results: [], total: 0, query };
  });
}
