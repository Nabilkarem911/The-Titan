import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { marketplaceListings, marketplaceReviews } from '@titan/database';

export const marketplaceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/api/v1/marketplace/browse', { preHandler: [requireAuth] }, async (req, reply) => {
    const { type, sort, page } = req.query as { type?: string; sort?: string; page?: string };
    const result = await marketplaceListings.browse({ type, sort, page: Number(page ?? 1) });
    return reply.send({ listings: result.listings, total: result.total, page: Number(page ?? 1), filters: { type, sort } });
  });

  app.get('/api/v1/marketplace/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const listing = await marketplaceListings.getById(id);
    if (!listing) return reply.code(404).send({ error: 'Listing not found' });
    return reply.send({ id, found: true, listing });
  });

  app.post('/api/v1/marketplace/publish', { preHandler: [requireAuth] }, async (req, reply) => {
    const { type, name, description, manifest } = req.body as { type: string; name: string; description: string; manifest: unknown };
    const userId = req.auth?.userId ?? null;
    const listing = await marketplaceListings.insert({ type, name, description, manifest, authorId: userId });
    return reply.send({ published: true, listing });
  });

  app.post('/api/v1/marketplace/:id/install', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await marketplaceListings.incrementDownloads(id);
    return reply.send({ id, installed: true });
  });

  app.post('/api/v1/marketplace/:id/rate', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rating, comment } = req.body as { rating: number; comment?: string };
    if (!rating || rating < 1 || rating > 5) return reply.code(400).send({ error: 'rating 1-5 required' });
    const userId = req.auth?.userId ?? null;
    const review = await marketplaceReviews.insert({ listingId: id, userId, rating, comment });
    return reply.send({ id, rating, review });
  });

  app.get('/api/v1/marketplace/featured', { preHandler: [requireAuth] }, async (_req, reply) => {
    const featured = await marketplaceListings.getFeatured();
    return reply.send(featured);
  });
};
