import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ExperienceCollector, FeedbackProcessor, PromptOptimizer, StrategyTuner } from '@titan/agent-engine';
import { requireAuth } from '../plugins/auth.js';

// Singletons — persist for server lifetime
const experienceCollector = new ExperienceCollector();
const feedbackProcessor = new FeedbackProcessor();
const promptOptimizer = new PromptOptimizer();
const strategyTuner = new StrategyTuner();

export const learningRoutesV2: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/learning/v2/feedback — real feedback summary
  app.get('/api/v1/learning/v2/feedback', { preHandler: [requireAuth] }, async (req, reply) => {
    const { userId } = req.query as { userId?: string };
    const summary = feedbackProcessor.getSummary(userId);
    return reply.send(summary);
  });

  // POST /api/v1/learning/v2/feedback/:runId — record real feedback
  app.post('/api/v1/learning/v2/feedback/:runId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    const { rating, comment } = req.body as { rating: 'positive' | 'negative' | 'neutral'; comment?: string };

    if (!['positive', 'negative', 'neutral'].includes(rating)) {
      return reply.status(400).send({ error: 'rating must be positive, negative, or neutral' });
    }

    const userId = (req as { user?: { id?: string } }).user?.id || 'unknown';
    feedbackProcessor.record({ runId, userId, rating, comment, timestamp: new Date() });

    // Also record as experience feedback
    experienceCollector.record({
      id: `${runId}_fb`,
      runId,
      prompt: '',
      strategy: 'default',
      toolsUsed: [],
      success: rating === 'positive',
      userFeedback: rating,
      tokensUsed: 0,
      durationMs: 0,
      timestamp: new Date(),
    });

    return reply.send({ recorded: true, runId, rating });
  });

  // GET /api/v1/learning/v2/insights — real insights from experience collector
  app.get('/api/v1/learning/v2/insights', { preHandler: [requireAuth] }, async (_req, reply) => {
    const insights = experienceCollector.getInsights();
    return reply.send({ insights, total: insights.length });
  });

  // GET /api/v1/learning/v2/patterns — strategy performance from strategy tuner
  app.get('/api/v1/learning/v2/patterns', { preHandler: [requireAuth] }, async (_req, reply) => {
    const patterns = strategyTuner.getPerformance();
    return reply.send({ patterns, total: patterns.length });
  });

  // GET /api/v1/learning/v2/suggestions — prompt optimization suggestions
  app.get('/api/v1/learning/v2/suggestions', { preHandler: [requireAuth] }, async (_req, reply) => {
    const stats = promptOptimizer.getStats();
    const suggestions: Array<{ category: string; bestVariant: string; successRate: number; uses: number }> = [];
    for (const [category, variants] of Object.entries(stats)) {
      const best = variants.sort((a, b) => b.successRate * b.uses - a.successRate * a.uses)[0];
      if (best) {
        suggestions.push({ category, bestVariant: best.id, successRate: best.successRate, uses: best.uses });
      }
    }
    return reply.send({ suggestions, total: suggestions.length });
  });

  // GET /api/v1/learning/v2/stats — overall learning stats
  app.get('/api/v1/learning/v2/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const feedbackSummary = feedbackProcessor.getSummary();
    const insights = experienceCollector.getInsights();
    const promptStats = promptOptimizer.getStats();
    const patternCount = strategyTuner.getPerformance().length;

    return reply.send({
      totalFeedback: feedbackSummary.totalFeedback,
      positiveRate: feedbackSummary.positiveRate,
      negativeRate: feedbackSummary.negativeRate,
      totalInsights: insights.length,
      totalPatterns: patternCount,
      promptCategories: Object.keys(promptStats).length,
      topComplaints: feedbackSummary.topComplaints,
      topPraises: feedbackSummary.topPraises,
    });
  });
};
