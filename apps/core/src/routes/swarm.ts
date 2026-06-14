import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SwarmOrchestrator, type AgentRunInput, type SwarmSubTask } from '@titan/agent-engine';
import { agentRuns } from '@titan/database';
import { ValidationError } from '@titan/shared';
import { requireAuth } from '../plugins/auth.js';

const SwarmInputSchema = z.object({
  description: z.string().min(1).max(500),
  prompt: z.string().min(1).max(10_000),
  agents: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['planner', 'researcher', 'coder', 'reviewer', 'executor', 'synthesizer']),
      name: z.string(),
      description: z.string(),
      systemPrompt: z.string().optional(),
      allowedTools: z.array(z.string()).optional(),
      maxSteps: z.number().int().min(1).max(50).optional().default(10),
      priority: z.number().int().optional().default(0),
    }),
  ).min(1).max(10),
});

const RATE_LIMIT_SWARM = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

export const swarmRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/api/v1/swarm/run', { preHandler: requireAuth, ...RATE_LIMIT_SWARM }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const input = SwarmInputSchema.parse(req.body);

    const orchestrator = new SwarmOrchestrator({
      createAgentRun: async (runInput: AgentRunInput) => {
        const run = await agentRuns.create({
          agentId: runInput.agentId,
          prompt: runInput.prompt,
          userId: runInput.userId ?? req.auth!.userId,
          workspaceId: req.auth!.workspaceId ?? undefined,
          apiKeyId: req.auth!.apiKeyId ?? undefined,
          maxSteps: runInput.maxSteps ?? 10,
        });
        return {
          id: run.id,
          agentId: run.agentId,
          prompt: run.prompt,
          status: run.status as 'running' | 'completed' | 'failed',
          maxSteps: run.maxSteps,
          currentStep: run.currentStep,
          tokensUsed: run.tokensUsed,
          steps: [],
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
        };
      },
      getAgentRun: async (runId: string) => {
        const run = await agentRuns.findById(runId);
        if (!run) return null;
        return {
          id: run.id,
          agentId: run.agentId,
          prompt: run.prompt,
          status: run.status as 'running' | 'completed' | 'failed',
          maxSteps: run.maxSteps,
          currentStep: run.currentStep,
          tokensUsed: run.tokensUsed,
          steps: [],
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
        };
      },
    });

    const task = await orchestrator.createTask({
      description: input.description,
      prompt: input.prompt,
      agents: input.agents,
      userId: req.auth.userId,
      workspaceId: req.auth.workspaceId ?? undefined,
      apiKeyId: req.auth.apiKeyId ?? undefined,
    });

    // Plan with a simple LLM-like mock (in production, use real provider)
    const planner = {
      complete: async () => ({
        content: JSON.stringify(
          input.agents.map((a, i) => ({
            role: a.role,
            prompt: `${a.description}: ${input.prompt}`,
            ...(i > 0 ? { dependsOn: i - 1 } : {}),
          })),
        ),
      }),
    };

    await orchestrator.plan(task, planner);
    await orchestrator.execute(task);

    const synthesizer = {
      complete: async () => ({
        content: task.subTasks.map((st: SwarmSubTask) => `[${st.agentRole}] ${st.result ?? 'No result'}`).join('\n'),
      }),
    };

    const result = await orchestrator.synthesize(task, synthesizer);

    return reply.status(200).send({
      taskId: result.taskId,
      status: result.status,
      finalAnswer: result.finalAnswer,
      subTasks: result.subTaskResults,
      completedAt: result.completedAt.toISOString(),
    });
  });
};
