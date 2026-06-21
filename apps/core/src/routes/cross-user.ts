import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { getCrossUserLearner } from '@titan/agent-engine';

export const crossUserRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/cross-user/insights — get aggregated cross-user insights
  app.get('/api/v1/cross-user/insights', { preHandler: [requireAuth] }, async (req, reply) => {
    const { category, minFrequency } = req.query as { category?: string; minFrequency?: string };
    const learner = getCrossUserLearner();
    const insights = learner.getInsights(
      category as any,
      minFrequency ? Number(minFrequency) : 3,
    );
    return reply.send({ insights });
  });

  // GET /api/v1/cross-user/patterns — get top patterns
  app.get('/api/v1/cross-user/patterns', { preHandler: [requireAuth] }, async (req, reply) => {
    const { category, count } = req.query as { category?: string; count?: string };
    const learner = getCrossUserLearner();
    const patterns = learner.getTopPatterns(
      category as any,
      count ? Number(count) : 10,
    );
    return reply.send({ patterns });
  });

  // GET /api/v1/cross-user/recommendations — get recommendations for current user
  app.get('/api/v1/cross-user/recommendations', { preHandler: [requireAuth] }, async (req, reply) => {
    const { taskType } = req.query as { taskType?: string };
    const learner = getCrossUserLearner();
    const recommendations = learner.getRecommendationsForUser(req.auth!.userId, taskType);
    return reply.send({ recommendations });
  });

  // GET /api/v1/cross-user/stats — get aggregate stats
  app.get('/api/v1/cross-user/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const learner = getCrossUserLearner();
    return reply.send(learner.stats());
  });

  // POST /api/v1/cross-user/record — record a pattern (internal use)
  app.post('/api/v1/cross-user/record', { preHandler: [requireAuth] }, async (req, reply) => {
    const { pattern, category, success } = req.body as {
      pattern: string;
      category: string;
      success: boolean;
    };
    if (!pattern || !category) {
      return reply.code(400).send({ error: 'pattern and category are required' });
    }
    const learner = getCrossUserLearner();
    learner.recordPattern(req.auth!.userId, pattern, category as any, success);
    return reply.send({ recorded: true });
  });
};
