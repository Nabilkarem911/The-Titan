import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { getGlobalToolRegistry } from '@titan/agent-engine';
import { experiences } from '@titan/database';

export const commandRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/command — execute a command via the tool registry
  app.post('/api/v1/command', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { tool, params } = req.body as { tool: string; params?: Record<string, unknown> };
    if (!tool) return reply.code(400).send({ error: 'tool is required' });

    const registry = getGlobalToolRegistry();
    const registered = registry.list();
    const found = registered.find((t) => t.name === tool);
    if (!found) return reply.code(404).send({ error: `Tool "${tool}" not found` });

    try {
      const result = await registry.execute(tool, params ?? {});
      return reply.send({ tool, params, result });
    } catch (err) {
      return reply.code(500).send({ error: 'Tool execution failed', detail: String(err) });
    }
  });

  // POST /api/v1/command/dream — run dream mode from stored experiences
  app.post('/api/v1/command/dream', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { limit } = req.body as { limit?: number };
    const recentExperiences = await experiences.getRecent(limit ?? 30);
    if (recentExperiences.length === 0) {
      return reply.code(400).send({ error: 'No experiences found in database to dream on' });
    }

    const registry = getGlobalToolRegistry();
    try {
      const result = await registry.execute('dream_from_experiences', {
        experiences: JSON.stringify(recentExperiences),
      });
      return reply.send({ tool: 'dream_from_experiences', experiencesReviewed: recentExperiences.length, result });
    } catch (err) {
      return reply.code(500).send({ error: 'Dream mode execution failed', detail: String(err) });
    }
  });

  // GET /api/v1/command/tools — list all available tools
  app.get('/api/v1/command/tools', { preHandler: [requireAuth] }, async (_req, reply) => {
    const registry = getGlobalToolRegistry();
    const tools = registry.list().map((t) => ({
      name: t.name,
      description: t.description,
      tags: t.tags,
      requiredParams: t.requiredParams ?? [],
    }));
    return reply.send({ tools, count: tools.length });
  });
};
