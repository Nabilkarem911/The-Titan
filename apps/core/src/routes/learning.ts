import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { runFeedback, experiences } from '@titan/database';

export const learningRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/api/v1/learning/feedback', { preHandler: [requireAuth] }, async (req, reply) => {
    const { limit } = req.query as { limit?: string };
    const feedback = await runFeedback.getRecent(Number(limit ?? 100));
    const stats = await runFeedback.getStats();
    return reply.send({ feedback, total: stats.total, positiveRate: stats.positiveRate });
  });

  app.post('/api/v1/learning/feedback/:runId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    const { rating, comment } = req.body as { rating: string; comment?: string };
    if (!['positive', 'negative', 'neutral'].includes(rating)) {
      return reply.code(400).send({ error: 'rating must be positive, negative, or neutral' });
    }
    const userId = req.auth?.userId ?? null;
    await runFeedback.insert({ runId, userId, rating, comment });
    return reply.send({ runId, rating, comment, recorded: true });
  });

  app.get('/api/v1/learning/insights', { preHandler: [requireAuth] }, async (_req, reply) => {
    const recentExperiences = await experiences.getRecent(100);
    const successCount = recentExperiences.filter((e) => (e as unknown as Record<string, unknown>).success).length;
    const total = recentExperiences.length;
    return reply.send({
      insights: [
        { type: 'performance', description: `${successCount}/${total} recent experiences succeeded`, confidence: total > 0 ? successCount / total : 0, evidence: total },
      ],
      totalExperiences: total,
    });
  });

  app.get('/api/v1/learning/patterns', { preHandler: [requireAuth] }, async (_req, reply) => {
    const recentExperiences = await experiences.getRecent(200);
    const strategyCounts: Record<string, number> = {};
    for (const e of recentExperiences) {
      const strategy = (e as unknown as Record<string, unknown>).strategy as string;
      if (strategy) strategyCounts[strategy] = (strategyCounts[strategy] ?? 0) + 1;
    }
    const patterns = Object.entries(strategyCounts).map(([strategy, count]) => ({ strategy, count }));
    return reply.send({ patterns });
  });

  app.get('/api/v1/learning/suggestions', { preHandler: [requireAuth] }, async (_req, reply) => {
    const recentExperiences = await experiences.getRecent(50);
    const failed = recentExperiences.filter((e) => !(e as unknown as Record<string, unknown>).success);
    const suggestions = failed.slice(0, 5).map((e) => ({
      type: 'retry',
      description: `Retry failed experience: ${(e as unknown as Record<string, unknown>).prompt as string}`.slice(0, 100),
    }));
    return reply.send({ suggestions });
  });
};
