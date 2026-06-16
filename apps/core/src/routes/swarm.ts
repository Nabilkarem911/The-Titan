import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createProviderFromEnv } from '@titan/agent-engine';
import { ValidationError, QUEUE_NAMES } from '@titan/shared';
import { enqueue } from '@titan/queue';
import { requireAuth } from '../plugins/auth.js';
import { storeSwarmTask, getSwarmTask, listSwarmTasks } from '../swarm-store.js';

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

  // POST /api/v1/swarm/run — launch a multi-agent swarm task (async, queue-based)
  app.post('/api/v1/swarm/run', { preHandler: requireAuth, ...RATE_LIMIT_SWARM }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const input = SwarmInputSchema.parse(req.body);

    // Validate LLM provider is configured before enqueuing
    const provider = createProviderFromEnv();
    if (!provider) throw new ValidationError('LLM provider not configured — cannot plan swarm task');

    const taskId = crypto.randomUUID();

    // Store initial task shell so GET /tasks/:taskId works immediately
    storeSwarmTask({
      id: taskId,
      description: input.description,
      originalPrompt: input.prompt,
      status: 'queued',
      agents: input.agents.map((a) => ({ ...a, systemPrompt: a.systemPrompt ?? '', allowedTools: a.allowedTools ?? [] })),
      subTasks: [],
      finalAnswer: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Parameters<typeof storeSwarmTask>[0]);

    // Enqueue the heavy work (plan → execute → synthesize) to the SWARM_EXECUTE queue
    await enqueue(QUEUE_NAMES.SWARM_EXECUTE, 'swarm.run', {
      taskId,
      description: input.description,
      prompt: input.prompt,
      agents: input.agents,
      userId: req.auth.userId,
      workspaceId: req.auth.workspaceId ?? undefined,
      apiKeyId: req.auth.apiKeyId ?? undefined,
    });

    return reply.status(202).send({
      taskId,
      status: 'queued',
      message: 'Swarm task queued for execution. Poll GET /api/v1/swarm/tasks/:taskId for results.',
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
