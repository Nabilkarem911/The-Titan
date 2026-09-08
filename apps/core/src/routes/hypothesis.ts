import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { HypothesisTester, createProviderFromEnv } from '@titan/agent-engine';

let tester: HypothesisTester | null = null;

function getTester(): HypothesisTester | null {
  if (tester) return tester;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  tester = new HypothesisTester(llm);
  return tester;
}

export const hypothesisRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/hypothesis/generate — generate hypotheses for a problem
  app.post('/api/v1/hypothesis/generate', { preHandler: [requireAuth] }, async (req, reply) => {
    const { problem, context } = req.body as { problem: string; context?: string };
    if (!problem) return reply.code(400).send({ error: 'problem is required' });

    const t = getTester();
    if (!t) return reply.code(503).send({ error: 'No LLM provider available' });

    const hypotheses = await t.generateHypotheses(problem, context);
    return reply.send({ hypotheses });
  });

  // POST /api/v1/hypothesis/evaluate — evaluate test results against a hypothesis
  app.post('/api/v1/hypothesis/evaluate', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { hypothesis, testOutput } = req.body as {
      hypothesis: {
        id: string;
        statement: string;
        rationale: string;
        testAction: string;
        expectedIfTrue: string;
        expectedIfFalse: string;
        confidence: number;
        status: string;
      };
      testOutput: string;
    };

    if (!hypothesis || !testOutput) {
      return reply.code(400).send({ error: 'hypothesis and testOutput are required' });
    }

    const t = getTester();
    if (!t) return reply.code(503).send({ error: 'No LLM provider available' });

    const result = await t.evaluateResult(hypothesis as Parameters<typeof t.evaluateResult>[0], testOutput);
    return reply.send(result);
  });

  // GET /api/v1/hypothesis/history — get hypothesis history
  app.get('/api/v1/hypothesis/history', { preHandler: [requireAuth] }, async (_req, reply) => {
    const t = getTester();
    if (!t) return reply.send({ history: [], confirmed: [], refuted: [] });
    return reply.send({
      history: t.getHistory(),
      confirmed: t.getConfirmed(),
      refuted: t.getRefuted(),
    });
  });
};
