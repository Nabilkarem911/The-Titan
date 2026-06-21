import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { getLogger } from '@titan/logging';
import { SelfForge } from '@titan/agent-engine';
import { createProviderFromEnv } from '@titan/agent-engine';

const log = getLogger().child({ component: 'self-forge-routes' });

let forgeInstance: SelfForge | null = null;

function getForge(): SelfForge | null {
  if (forgeInstance) return forgeInstance;
  const llm = createProviderFromEnv();
  if (!llm) {
    log.warn('no LLM provider available — self-forge disabled');
    return null;
  }
  forgeInstance = new SelfForge(llm);
  return forgeInstance;
}

export const selfForgeRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/forge/tool — forge a new tool from capability description
  app.post('/api/v1/forge/tool', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { capability, reason } = req.body as { capability: string; reason?: string };

    if (!capability || typeof capability !== 'string') {
      return reply.code(400).send({ error: 'capability is required' });
    }

    const forge = getForge();
    if (!forge) return reply.code(503).send({ error: 'Self-forge unavailable — no LLM provider' });

    const result = await forge.forgeTool(capability, reason ?? 'User requested new tool capability');
    return reply.send(result);
  });

  // GET /api/v1/forge/tools — list all forged tools
  app.get('/api/v1/forge/tools', { preHandler: [requireAuth] }, async (_req, reply) => {
    const forge = getForge();
    if (!forge) return reply.send({ tools: [] });
    return reply.send({ tools: forge.listForgedTools() });
  });

  // DELETE /api/v1/forge/tools/:name — remove a forged tool
  app.delete('/api/v1/forge/tools/:name', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { name } = req.params as { name: string };
    const forge = getForge();
    if (!forge) return reply.code(503).send({ error: 'Self-forge unavailable' });

    const removed = forge.removeForgedTool(name);
    return reply.send({ removed, toolName: name });
  });
};
