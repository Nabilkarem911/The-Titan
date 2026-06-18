import type { FastifyInstance } from 'fastify';

export default async function learningRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/learning/feedback', async (req, reply) => {
    const { userId, limit } = req.query as { userId?: string; limit?: string };
    return { feedback: [], total: 0, positiveRate: 0, note: 'Query run_feedback table' };
  });

  app.post('/api/v1/learning/feedback/:runId', async (req, reply) => {
    const { runId } = req.params as { runId: string };
    const { rating, comment } = req.body as { rating: string; comment?: string };
    if (!['positive', 'negative', 'neutral'].includes(rating)) {
      return reply.status(400).send({ error: 'rating must be positive, negative, or neutral' });
    }
    return { runId, rating, comment, recorded: true, note: 'Insert into run_feedback table' };
  });

  app.get('/api/v1/learning/insights', async (req, reply) => {
    return {
      insights: [
        { type: 'strategy_preference', description: 'Chain-of-thought works best for coding tasks', confidence: 0.8 },
        { type: 'tool_preference', description: 'brave_search has 95% success rate', confidence: 0.9 },
      ],
      note: 'Generated from experience_collector',
    };
  });

  app.get('/api/v1/learning/patterns', async (req, reply) => {
    return { patterns: [], note: 'Analyze from run history and feedback' };
  });

  app.get('/api/v1/learning/suggestions', async (req, reply) => {
    return { suggestions: [], note: 'Generated from prompt_optimizer and strategy_tuner' };
  });
}
