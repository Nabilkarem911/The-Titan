import type { FastifyInstance } from 'fastify';

export default async function marketplaceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/marketplace/browse', async (req, reply) => {
    const { type, sort, page } = req.query as { type?: string; sort?: string; page?: string };
    return { listings: [], total: 0, page: Number(page ?? 1), filters: { type, sort } };
  });

  app.get('/api/v1/marketplace/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return { id, found: false, note: 'Query marketplace_listings table' };
  });

  app.post('/api/v1/marketplace/publish', async (req, reply) => {
    const { type, name, description, manifest } = req.body as { type: string; name: string; description: string; manifest: unknown };
    return { published: true, type, name, note: 'Insert into marketplace_listings' };
  });

  app.post('/api/v1/marketplace/:id/install', async (req, reply) => {
    const { id } = req.params as { id: string };
    return { id, installed: true, note: 'Download and register plugin/agent' };
  });

  app.post('/api/v1/marketplace/:id/rate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rating, comment } = req.body as { rating: number; comment?: string };
    if (!rating || rating < 1 || rating > 5) return reply.status(400).send({ error: 'rating 1-5 required' });
    return { id, rating, recorded: true, note: 'Insert into marketplace_reviews' };
  });

  app.get('/api/v1/marketplace/featured', async (req, reply) => {
    return { featured: [], trending: [], newest: [] };
  });
}
