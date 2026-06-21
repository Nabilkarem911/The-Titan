import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { snapshot, incCounter } from '@titan/observability';
import { requireAuth } from '../plugins/auth.js';
import { getExperienceCollector, getStrategyTuner, getPromptOptimizer } from '../learning-singleton.js';
import { getPreferenceLearner, getProfileBuilder } from '../preference-singleton.js';
import { getGraphStore } from '../jobs/memory-consolidation.js';

export const insightsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/insights/overview — full agent insights dashboard data
  app.get('/api/v1/insights/overview', { preHandler: [requireAuth] }, async (_req, reply) => {
    const metrics = snapshot();

    const experience = getExperienceCollector();
    const strategyTuner = getStrategyTuner();
    const promptOptimizer = getPromptOptimizer();
    const graphStore = getGraphStore();

    const insights = experience.getInsights();
    const strategyPerformance = strategyTuner.getPerformance();
    const promptStats = promptOptimizer.getStats();
    const graphStats = graphStore.stats();

    return reply.send({
      metrics,
      insights,
      strategyPerformance,
      promptStats,
      knowledgeGraph: {
        entities: graphStats.entities,
        relations: graphStats.relations,
        topEntities: graphStats.topEntities,
      },
      experienceStats: experience.getStats(),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/v1/insights/experiences — agent run experiences stats
  app.get('/api/v1/insights/experiences', { preHandler: [requireAuth] }, async (_req, reply) => {
    const experience = getExperienceCollector();
    return reply.send({
      stats: experience.getStats(),
      insights: experience.getInsights(),
    });
  });

  // GET /api/v1/insights/strategies — strategy performance stats
  app.get('/api/v1/insights/strategies', { preHandler: [requireAuth] }, async (_req, reply) => {
    const strategyTuner = getStrategyTuner();
    return reply.send({ strategies: strategyTuner.getPerformance() });
  });

  // GET /api/v1/insights/prompts — prompt optimization status
  app.get('/api/v1/insights/prompts', { preHandler: [requireAuth] }, async (_req, reply) => {
    const promptOptimizer = getPromptOptimizer();
    return reply.send({ prompts: promptOptimizer.getStats() });
  });

  // GET /api/v1/insights/preferences — learned user preferences
  app.get('/api/v1/insights/preferences', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = (req.query as { userId?: string }).userId ?? req.auth!.userId;
    const learner = getPreferenceLearner();
    const builder = getProfileBuilder();
    const prefs = learner.getPreferences(userId);
    const profile = builder.getOrCreate(userId);

    return reply.send({
      userId,
      preferences: prefs,
      profile: {
        expertise: profile.expertise,
        communicationStyle: profile.communicationStyle,
        relationship: profile.relationship,
        totalInteractions: profile.totalInteractions,
        preferredLanguage: profile.preferredLanguage,
      },
    });
  });

  // GET /api/v1/insights/knowledge-graph — entity graph stats
  app.get('/api/v1/insights/knowledge-graph', { preHandler: [requireAuth] }, async (_req, reply) => {
    const graphStore = getGraphStore();
    return reply.send(graphStore.stats());
  });

  // POST /api/v1/insights/feedback — record user feedback for learning
  app.post('/api/v1/insights/feedback', { preHandler: [requireAuth] }, async (req, reply) => {
    const { runId, feedback, score } = req.body as {
      runId: string;
      feedback: 'positive' | 'negative';
      score?: number;
    };

    if (!runId || !feedback) {
      return reply.code(400).send({ error: 'runId and feedback are required' });
    }

    incCounter('agent_feedback_total', 'User feedback on agent runs', 1, { type: feedback });

    return reply.send({ recorded: true, runId, feedback });
  });
};
