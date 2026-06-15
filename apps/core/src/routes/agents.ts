import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { agentRuns, agentSteps } from '@titan/database';
import { enqueue, QUEUE_NAMES } from '@titan/queue';
import { ValidationError } from '@titan/shared';
import { requireAuth } from '../plugins/auth.js';
import { createProviderFromEnv } from '@titan/agent-engine';
import type { LlmMessage } from '@titan/agent-engine';

const RunAgentInputSchema = z.object({
  prompt: z.string().min(1).max(10_000),
  maxSteps: z.number().int().min(1).max(50).optional().default(10),
  tokenBudget: z.number().int().min(1).optional(),
  forbiddenTools: z.array(z.string()).optional(),
});

const RATE_LIMIT_AGENT_WRITE = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };
const RATE_LIMIT_AGENT_READ = { config: { rateLimit: { max: 200, timeWindow: '1 minute' } } };

export const agentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/agents/:agentId/run
  app.post<{ Params: { agentId: string } }>(
    '/api/v1/agents/:agentId/run',
    { preHandler: requireAuth, ...RATE_LIMIT_AGENT_WRITE },
    async (req, reply) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const { agentId } = req.params;
      const input = RunAgentInputSchema.parse(req.body);

      const run = await agentRuns.create({
        agentId,
        prompt: input.prompt,
        userId: req.auth.userId,
        workspaceId: req.auth.workspaceId ?? undefined,
        apiKeyId: req.auth.apiKeyId ?? undefined,
        maxSteps: input.maxSteps,
        tokenBudget: input.tokenBudget,
        forbiddenTools: input.forbiddenTools,
      });

      const jobId = await enqueue(QUEUE_NAMES.AGENT_EXECUTE, 'agent.run', {
        prompt: input.prompt,
        runId: run.id,
        agentId,
        userId: req.auth.userId,
        workspaceId: req.auth.workspaceId ?? undefined,
        apiKeyId: req.auth.apiKeyId ?? undefined,
        maxSteps: input.maxSteps,
        tokenBudget: input.tokenBudget,
        forbiddenTools: input.forbiddenTools,
      });

      return reply.status(202).send({
        runId: run.id,
        jobId,
        status: run.status,
        agentId,
        prompt: input.prompt,
        createdAt: run.createdAt.toISOString(),
      });
    },
  );

  // GET /api/v1/agents/:agentId/runs
  app.get<{ Params: { agentId: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/v1/agents/:agentId/runs',
    { preHandler: requireAuth, ...RATE_LIMIT_AGENT_READ },
    async (req) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const { agentId } = req.params;
      const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100);
      const offset = parseInt(req.query.offset ?? '0', 10);
      const runs = await agentRuns.listForAgent(agentId, { limit, offset });
      return {
        items: runs.map((r: Awaited<ReturnType<typeof agentRuns.listForAgent>>[number]) => ({
          id: r.id,
          agentId: r.agentId,
          status: r.status,
          prompt: r.prompt.substring(0, 200),
          maxSteps: r.maxSteps,
          currentStep: r.currentStep,
          tokensUsed: r.tokensUsed,
          tokenBudget: r.tokenBudget,
          finalAnswer: r.finalAnswer,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        total: runs.length,
      };
    },
  );

  // GET /api/v1/agents/:agentId/runs/:runId
  app.get<{ Params: { agentId: string; runId: string } }>(
    '/api/v1/agents/:agentId/runs/:runId',
    { preHandler: requireAuth, ...RATE_LIMIT_AGENT_READ },
    async (req) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const { runId } = req.params;
      const run = await agentRuns.findById(runId);
      if (!run) {
        throw new ValidationError('Run not found');
      }
      return {
        id: run.id,
        agentId: run.agentId,
        status: run.status,
        prompt: run.prompt,
        maxSteps: run.maxSteps,
        currentStep: run.currentStep,
        tokensUsed: run.tokensUsed,
        tokenBudget: run.tokenBudget,
        forbiddenTools: run.forbiddenTools,
        finalAnswer: run.finalAnswer,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
      };
    },
  );

  // POST /api/v1/agents/:agentId/stream  — SSE streaming chat
  app.post<{ Params: { agentId: string } }>(
    '/api/v1/agents/:agentId/stream',
    { preHandler: requireAuth },
    async (req, reply) => {
      if (!req.auth) throw new ValidationError('Authentication required');

      const { prompt, systemPrompt, history } = req.body as {
        prompt: string;
        systemPrompt?: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      };

      if (!prompt) throw new ValidationError('prompt is required');

      const provider = createProviderFromEnv();
      if (!provider || !provider.stream) {
        throw new ValidationError('Streaming is not supported by the current LLM provider');
      }

      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt ?? 'You are Titan, a helpful AI assistant.' },
        ...(history ?? []).map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: prompt },
      ];

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders();

      try {
        for await (const chunk of provider.stream(messages)) {
          reply.raw.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }
        reply.raw.write('data: [DONE]\n\n');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        reply.raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      } finally {
        reply.raw.end();
      }
    },
  );

  // GET /api/v1/agents/:agentId/runs/:runId/steps
  app.get<{ Params: { agentId: string; runId: string } }>(
    '/api/v1/agents/:agentId/runs/:runId/steps',
    { preHandler: requireAuth, ...RATE_LIMIT_AGENT_READ },
    async (req) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const { runId } = req.params;
      const steps = await agentSteps.listForRun(runId);
      return {
        items: steps.map((s: Awaited<ReturnType<typeof agentSteps.listForRun>>[number]) => ({
          id: s.id,
          runId: s.runId,
          stepIndex: s.stepIndex,
          status: s.status,
          thought: s.thought,
          plan: s.plan,
          actionName: s.actionName,
          actionParams: s.actionParams,
          observationSuccess: s.observationSuccess,
          observationData: s.observationData,
          observationError: s.observationError,
          reflection: s.reflection,
          tokensUsed: s.tokensUsed,
          latencyMs: s.latencyMs,
          createdAt: s.createdAt.toISOString(),
        })),
        total: steps.length,
      };
    },
  );
};
