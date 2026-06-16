import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AgentRunner, MockLlmProvider, createProviderFromEnv, getGlobalToolRegistry, type ToolCall, type ToolResult, type AgentRun, type AgentStep } from '@titan/agent-engine';
import { MemoryClient } from '@titan/memory';
import { agentRuns, agentSteps, userContext, getChatHistory, saveChatMessage } from '@titan/database';
import { ValidationError } from '@titan/shared';
import { getLogger } from '@titan/logging';
import { requireAuth } from '../plugins/auth.js';
import { getWsServer } from '../ws-instance.js';

const log = getLogger().child({ component: 'chat' });

const ChatInputSchema = z.object({
  sessionId: z.string().min(1).max(200).optional(),
  prompt: z.string().min(1).max(50_000),
  agentId: z.string().min(1).max(200).optional().default('default-agent'),
  maxSteps: z.number().int().min(1).max(50).optional().default(10),
  stream: z.boolean().optional().default(true),
});

const RATE_LIMIT_CHAT = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

export const chatRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/chat — Multi-turn chat with agent (streaming SSE)
  app.post(
    '/api/v1/chat',
    { preHandler: requireAuth, ...RATE_LIMIT_CHAT },
    async (req, reply) => {
      if (!req.auth) throw new ValidationError('Authentication required');

      const input = ChatInputSchema.parse(req.body);
      const userId = req.auth.userId;
      const sessionId = input.sessionId ?? `session:${userId}:${input.agentId}`;

      // Load user context and recent history
      const [ctx, history] = await Promise.all([
        userContext.getAll(userId),
        getChatHistory(sessionId, 20),
      ]);

      // Save incoming user message
      await saveChatMessage(sessionId, 'user', input.prompt);

      // Build context for system prompt
      const ctxLines = Object.entries(ctx).map(([k, v]) => `- ${k}: ${v}`);
      const historyLines = history.map((m) => `${m.role === 'user' ? 'User' : 'Titan'}: ${m.content}`);

      const contextBlock = [
        ctxLines.length ? `\n\nUser context:\n${ctxLines.join('\n')}` : '',
        historyLines.length ? `\n\nRecent conversation:\n${historyLines.join('\n')}` : '',
      ].join('');

      // Create DB run record
      const dbRun = await agentRuns.create({
        agentId: input.agentId,
        prompt: input.prompt,
        userId,
        workspaceId: req.auth.workspaceId ?? undefined,
        apiKeyId: req.auth.apiKeyId ?? undefined,
        maxSteps: input.maxSteps,
      });
      const runId = dbRun.id;

      const registry = getGlobalToolRegistry();
      const memory = new MemoryClient();
      await memory.initialize();

      // Setup SSE headers if streaming
      if (input.stream) {
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');
        reply.raw.flushHeaders();

        // Send initial event with runId
        reply.raw.write(`data: ${JSON.stringify({ type: 'run.started', runId })}\n\n`);
      }

      const runner = new AgentRunner({
        llm: createProviderFromEnv() ?? new MockLlmProvider(),
        executeTool: async (call: ToolCall, _runId: string): Promise<ToolResult> => {
          try {
            const data = await registry.execute(call.name, call.params);
            return { success: true, data };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Tool failed' };
          }
        },
        memory,
        userContextItems: Object.keys(ctx).length > 0 ? ctx : undefined,
        persistRun: async (run: AgentRun) => {
          try {
            await agentRuns.updateStatus(runId, run.status, {
              currentStep: run.currentStep,
              tokensUsed: run.tokensUsed,
              finalAnswer: run.finalAnswer ?? undefined,
            });
          } catch (err) {
            log.warn({ err, runId }, 'failed to persist run');
          }
          if (input.stream) {
            reply.raw.write(`data: ${JSON.stringify({
              type: 'run.updated',
              runId,
              status: run.status,
              currentStep: run.currentStep,
              tokensUsed: run.tokensUsed,
            })}\n\n`);
          }
          getWsServer()?.broadcast('agent.run.updated', {
            runId,
            agentId: input.agentId,
            status: run.status,
            currentStep: run.currentStep,
            tokensUsed: run.tokensUsed,
            finalAnswer: run.finalAnswer ?? null,
          });
        },
        onStep: async (step: AgentStep) => {
          try {
            await agentSteps.create({
              runId,
              stepIndex: step.index,
              status: step.status,
              thought: step.thought,
              actionName: step.action?.name,
              actionParams: step.action?.params,
              observationSuccess: step.observation?.success,
              observationData: step.observation?.data as Record<string, unknown> | undefined,
              observationError: step.observation?.error,
              reflection: step.reflection,
              tokensUsed: step.tokensUsed,
              latencyMs: step.latencyMs,
            });
          } catch (err) {
            log.warn({ err, runId }, 'failed to persist step');
          }
          if (input.stream) {
            reply.raw.write(`data: ${JSON.stringify({
              type: 'step',
              runId,
              step: {
                index: step.index,
                status: step.status,
                thought: step.thought,
                actionName: step.action?.name,
                reflection: step.reflection,
                tokensUsed: step.tokensUsed,
                latencyMs: step.latencyMs,
              },
            })}\n\n`);
          }
          getWsServer()?.broadcast('agent.step', {
            runId,
            agentId: input.agentId,
            step: {
              index: step.index,
              status: step.status,
              thought: step.thought,
              actionName: step.action?.name,
              reflection: step.reflection,
              tokensUsed: step.tokensUsed,
              latencyMs: step.latencyMs,
            },
          });
        },
      });

      try {
        const result = await runner.run({
          runId,
          agentId: input.agentId,
          prompt: input.prompt,
          userId,
          workspaceId: req.auth.workspaceId ?? undefined,
          apiKeyId: req.auth.apiKeyId ?? undefined,
          maxSteps: input.maxSteps,
          systemPromptExtra: contextBlock,
        });

        const answer = result.finalAnswer?.trim() || 'لم أتمكن من إيجاد إجابة. حاول صياغة السؤال بشكل مختلف.';

        // Save assistant reply to history
        await saveChatMessage(sessionId, 'assistant', answer);

        if (input.stream) {
          reply.raw.write(`data: ${JSON.stringify({
            type: 'run.completed',
            runId,
            sessionId,
            answer,
            tokensUsed: result.tokensUsed,
            steps: result.steps.length,
          })}\n\n`);
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
        } else {
          return reply.send({
            runId,
            sessionId,
            answer,
            status: result.status,
            tokensUsed: result.tokensUsed,
            steps: result.steps.length,
          });
        }
      } catch (err) {
        log.error({ err, runId }, 'chat agent run failed');
        const errorMsg = err instanceof Error ? err.message : 'Agent run failed';
        if (input.stream) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
          reply.raw.end();
        } else {
          return reply.status(500).send({ error: errorMsg, runId });
        }
      }
    },
  );

  // GET /api/v1/chat/history — Get chat history for a session
  app.get<{ Querystring: { sessionId?: string; agentId?: string; limit?: string } }>(
    '/api/v1/chat/history',
    { preHandler: requireAuth },
    async (req) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const userId = req.auth.userId;
      const agentId = req.query.agentId ?? 'default-agent';
      const sessionId = req.query.sessionId ?? `session:${userId}:${agentId}`;
      const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);

      const messages = await getChatHistory(sessionId, limit);
      return { sessionId, messages, total: messages.length };
    },
  );
};
