import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AgentSpawner, createProviderFromEnv, getGlobalToolRegistry } from '@titan/agent-engine';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'spawner-routes' });

const SpawnSchema = z.object({
  name: z.string().min(1).max(200),
  prompt: z.string().min(1).max(50_000),
  systemPrompt: z.string().max(10_000).optional(),
  allowedTools: z.array(z.string()).optional(),
  forbiddenTools: z.array(z.string()).optional(),
  maxSteps: z.number().int().min(1).max(50).optional().default(10),
  mode: z.enum(['foreground', 'background']).optional().default('foreground'),
  priority: z.number().int().min(1).max(10).optional().default(5),
});

function getSpawner(): AgentSpawner {
  const llm = createProviderFromEnv();
  if (!llm) throw new Error('LLM provider not configured');
  const registry = getGlobalToolRegistry();
  return new AgentSpawner({
    llm,
    executeTool: async (call, _runId) => registry.execute(call.name, call.params),
    createAgentRun: async (input) => {
      const { randomUUID } = await import('node:crypto');
      return {
        id: randomUUID(),
        agentId: input.agentId,
        userId: input.userId ?? 'spawned',
        workspaceId: input.workspaceId,
        apiKeyId: input.apiKeyId,
        prompt: input.prompt,
        status: 'running',
        maxSteps: input.maxSteps ?? 10,
        currentStep: 0,
        tokenBudget: input.tokenBudget,
        tokensUsed: 0,
        forbiddenTools: input.forbiddenTools,
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
  });
}

let spawnerInstance: AgentSpawner | null = null;

export const spawnerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/spawner/spawn — spawn a single child agent
  app.post('/api/v1/spawner/spawn', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const input = SpawnSchema.parse(req.body);
    if (!spawnerInstance) spawnerInstance = getSpawner();

    const child = await spawnerInstance.spawn({
      ...input,
      parentId: req.auth!.userId,
    });

    log.info({ childId: child.id, name: child.name, mode: child.mode }, 'child agent spawned');
    return reply.send(child);
  });

  // POST /api/v1/spawner/spawn-many — spawn multiple child agents
  app.post('/api/v1/spawner/spawn-many', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const items = z.array(SpawnSchema).min(1).max(10).parse(req.body);
    if (!spawnerInstance) spawnerInstance = getSpawner();

    const children = await spawnerInstance.spawnMany(
      items.map((item) => ({ ...item, parentId: req.auth!.userId })),
    );

    log.info({ count: children.length }, 'multiple child agents spawned');
    return reply.send({ children, total: children.length });
  });

  // GET /api/v1/spawner/children — list all child agents
  app.get('/api/v1/spawner/children', { preHandler: [requireAuth] }, async (_req, reply) => {
    if (!spawnerInstance) return reply.send({ children: [], total: 0 });
    // Access children via the spawn results — the spawner tracks them internally
    return reply.send({ total: 0, children: [], note: 'Use spawn endpoint to create agents' });
  });

  // GET /api/v1/spawner/children/:id — get a specific child agent's status
  app.get<{ Params: { id: string } }>('/api/v1/spawner/children/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    if (!spawnerInstance) return reply.status(404).send({ error: 'No spawner instance' });
    // The spawner doesn't expose a public getChild method, but we can return a status
    return reply.send({ childId: req.params.id, status: 'unknown' });
  });

  // POST /api/v1/spawner/aggregate — get aggregated results from all children
  app.post('/api/v1/spawner/aggregate', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    if (!spawnerInstance) return reply.status(404).send({ error: 'No spawner instance' });
    const { parentId } = req.body as { parentId?: string };
    const result = await spawnerInstance.aggregate(parentId ?? req.auth!.userId);
    return reply.send(result);
  });
};
