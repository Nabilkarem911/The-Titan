import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { TeamBuilder } from '@titan/agent-engine';
import { requireAuth } from '../plugins/auth.js';

const teamBuilder = new TeamBuilder();

export const teamsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/teams/templates — list available team templates
  app.get('/api/v1/teams/templates', { preHandler: [requireAuth] }, async (_req, reply) => {
    const templates = teamBuilder.listTemplates();
    return reply.send({ items: templates, total: templates.length });
  });

  // GET /api/v1/teams/templates/:name — get a specific template with full details
  app.get('/api/v1/teams/templates/:name', { preHandler: [requireAuth] }, async (req, reply) => {
    const { name } = req.params as { name: string };
    const template = teamBuilder.getTemplate(name);
    if (!template) return reply.status(404).send({ error: 'Template not found' });
    return reply.send(template);
  });

  // POST /api/v1/teams/build — build a team from template and return agents
  app.post('/api/v1/teams/build', { preHandler: [requireAuth] }, async (req, reply) => {
    const { template, priority } = req.body as { template: string; priority?: number };
    const agents = teamBuilder.buildFromTemplate(template, priority || 5);
    return reply.send({ agents, total: agents.length, template });
  });

  // POST /api/v1/teams/build-custom — build a custom team with custom roles
  app.post('/api/v1/teams/build-custom', { preHandler: [requireAuth] }, async (req, reply) => {
    const { roles } = req.body as { roles: Array<{ role: string; name: string; description: string; systemPrompt?: string; tools?: string[]; maxSteps?: number }> };
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return reply.status(400).send({ error: 'roles array is required' });
    }
    const agents = teamBuilder.buildCustom(roles as Parameters<typeof teamBuilder.buildCustom>[0]);
    return reply.send({ agents, total: agents.length });
  });
};
