import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SwarmOrchestrator, createProviderFromEnv, AgentRunner, getGlobalToolRegistry, type AgentRunInput, type AgentRun } from '@titan/agent-engine';
import { agentRuns, agentSteps } from '@titan/database';
import { ValidationError } from '@titan/shared';
import { requireAuth } from '../plugins/auth.js';
import { storeSwarmTask, getSwarmTask, listSwarmTasks } from '../swarm-store.js';
import { MemoryClient } from '@titan/memory';

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

function buildRunAdapter(userId: string, workspaceId?: string, apiKeyId?: string) {
  return {
    createAgentRun: async (runInput: AgentRunInput): Promise<AgentRun> => {
      const provider = createProviderFromEnv();
      const registry = getGlobalToolRegistry();

      // Create DB record
      const dbRun = await agentRuns.create({
        agentId: runInput.agentId,
        prompt: runInput.prompt,
        userId: runInput.userId ?? userId,
        workspaceId: workspaceId,
        apiKeyId: apiKeyId,
        maxSteps: runInput.maxSteps ?? 10,
      });

      // Actually execute the agent
      const memory = new MemoryClient();

      const runner = new AgentRunner({
        llm: provider ?? { complete: async () => ({ content: 'Mock response', toolCalls: undefined, tokensUsed: 0, finishReason: 'stop' as const }) },
        executeTool: async (call, _runId) => registry.execute(call.name, call.params),
        memory: memory ?? undefined,
        persistRun: async (run) => {
          await agentRuns.updateStatus(run.id, run.status, { finalAnswer: run.finalAnswer ?? undefined, tokensUsed: run.tokensUsed });
        },
        onStep: async (step) => {
          await agentSteps.create({
            runId: step.runId,
            stepIndex: step.index,
            status: step.status,
            thought: step.thought,
            plan: step.plan,
            actionName: step.action?.name,
            actionParams: step.action?.params,
            observationSuccess: step.observation?.success,
            observationData: step.observation?.data as Record<string, unknown> | undefined,
            observationError: step.observation?.error,
            reflection: step.reflection,
            tokensUsed: step.tokensUsed,
            latencyMs: step.latencyMs,
          });
        },
      });

      const completedRun = await runner.run({
        agentId: runInput.agentId,
        prompt: runInput.prompt,
        userId: runInput.userId ?? userId,
        workspaceId,
        maxSteps: runInput.maxSteps ?? 10,
      });

      return completedRun;
    },

    getAgentRun: async (runId: string): Promise<AgentRun | null> => {
      const run = await agentRuns.findById(runId);
      if (!run) return null;
      return {
        id: run.id,
        agentId: run.agentId,
        prompt: run.prompt,
        status: run.status as AgentRun['status'],
        maxSteps: run.maxSteps,
        currentStep: run.currentStep,
        tokensUsed: run.tokensUsed,
        forbiddenTools: undefined,
        steps: [],
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      };
    },
  };
}

export const swarmRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // POST /api/v1/swarm/run — launch a multi-agent swarm task
  app.post('/api/v1/swarm/run', { preHandler: requireAuth, ...RATE_LIMIT_SWARM }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const input = SwarmInputSchema.parse(req.body);
    const provider = createProviderFromEnv();

    const deps = buildRunAdapter(req.auth.userId, req.auth.workspaceId ?? undefined, req.auth.apiKeyId ?? undefined);
    const orchestrator = new SwarmOrchestrator(deps);

    const task = await orchestrator.createTask({
      description: input.description,
      prompt: input.prompt,
      agents: input.agents,
      userId: req.auth.userId,
      workspaceId: req.auth.workspaceId ?? undefined,
      apiKeyId: req.auth.apiKeyId ?? undefined,
    });

    storeSwarmTask(task);

    // Plan — use real LLM if available
    const planner = provider ?? {
      complete: async () => ({
        content: JSON.stringify(
          input.agents.map((a, i) => ({
            role: a.role,
            prompt: `${a.description}: ${input.prompt}`,
            dependsOn: i > 0 ? [i - 1] : [],
          })),
        ),
        toolCalls: undefined,
        tokensUsed: 0,
        finishReason: 'stop' as const,
      }),
    };

    await orchestrator.plan(task, planner as { complete: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string }> });
    storeSwarmTask(task);

    // Execute all agents in parallel (respecting deps)
    await orchestrator.execute(task);
    storeSwarmTask(task);

    // Synthesize final answer — use real LLM if available
    const synthesizer = provider ?? {
      complete: async () => ({
        content: task.subTasks
          .filter((st) => st.status === 'completed')
          .map((st) => `[${st.agentRole.toUpperCase()}]: ${st.result ?? ''}`)
          .join('\n\n'),
        toolCalls: undefined,
        tokensUsed: 0,
        finishReason: 'stop' as const,
      }),
    };

    const result = await orchestrator.synthesize(task, synthesizer as { complete: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string }> });
    storeSwarmTask(task);

    return reply.status(200).send({
      taskId: result.taskId,
      status: result.status,
      finalAnswer: result.finalAnswer,
      subTasks: result.subTaskResults,
      agentsUsed: input.agents.length,
      completedAt: result.completedAt.toISOString(),
    });
  });

  // GET /api/v1/swarm/tasks — list recent swarm tasks
  app.get('/api/v1/swarm/tasks', { preHandler: requireAuth }, async (_req, reply) => {
    const tasks = listSwarmTasks(20);
    return reply.send({
      items: tasks.map((t) => ({
        id: t.id,
        description: t.description,
        status: t.status,
        agentsCount: t.agents.length,
        subTasksCount: t.subTasks.length,
        completedSubTasks: t.subTasks.filter((s) => s.status === 'completed').length,
        finalAnswer: t.finalAnswer ? t.finalAnswer.substring(0, 200) : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      total: tasks.length,
    });
  });

  // GET /api/v1/swarm/tasks/:taskId — full task details
  app.get<{ Params: { taskId: string } }>('/api/v1/swarm/tasks/:taskId', { preHandler: requireAuth }, async (req, reply) => {
    const task = getSwarmTask(req.params.taskId);
    if (!task) return reply.status(404).send({ error: 'Swarm task not found' });
    return reply.send({
      id: task.id,
      description: task.description,
      originalPrompt: task.originalPrompt,
      status: task.status,
      finalAnswer: task.finalAnswer,
      agents: task.agents.map((a) => ({ id: a.id, role: a.role, name: a.name })),
      subTasks: task.subTasks.map((st) => ({
        id: st.id,
        agentRole: st.agentRole,
        status: st.status,
        prompt: st.prompt.substring(0, 200),
        result: st.result ? st.result.substring(0, 500) : null,
        runId: st.runId,
        createdAt: st.createdAt.toISOString(),
        updatedAt: st.updatedAt.toISOString(),
      })),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    });
  });
};
