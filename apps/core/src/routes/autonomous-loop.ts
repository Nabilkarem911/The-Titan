import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { getLogger } from '@titan/logging';
import { AutonomousLoop, createProviderFromEnv, getGlobalToolRegistry } from '@titan/agent-engine';

const log = getLogger().child({ component: 'autonomous-routes' });

let autonomousLoop: AutonomousLoop | null = null;

function getLoop(): AutonomousLoop | null {
  if (autonomousLoop) return autonomousLoop;
  const llm = createProviderFromEnv();
  if (!llm) {
    log.warn('no LLM provider — autonomous loop disabled');
    return null;
  }
  const registry = getGlobalToolRegistry();
  autonomousLoop = new AutonomousLoop(
    llm,
    async (toolName, params) => registry.execute(toolName, params),
    { enabled: process.env['AUTONOMOUS_LOOP_ENABLED'] === 'true' },
  );
  return autonomousLoop;
}

export const autonomousLoopRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/autonomous-loop/status — get loop status and config
  app.get('/api/v1/autonomous-loop/status', { preHandler: [requireAuth] }, async (_req, reply) => {
    const loop = getLoop();
    if (!loop) return reply.send({ enabled: false, checks: [], results: [] });
    return reply.send({
      enabled: loop.isEnabled(),
      config: loop.getConfig(),
      checks: loop.getChecks(),
      results: loop.getResults(20),
    });
  });

  // POST /api/v1/autonomous-loop/start — start the autonomous loop
  app.post('/api/v1/autonomous-loop/start', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const loop = getLoop();
    if (!loop) return reply.code(503).send({ error: 'Autonomous loop unavailable — no LLM provider' });
    loop.setEnabled(true);
    return reply.send({ started: true });
  });

  // POST /api/v1/autonomous-loop/stop — stop the autonomous loop
  app.post('/api/v1/autonomous-loop/stop', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const loop = getLoop();
    if (!loop) return reply.send({ stopped: true });
    loop.setEnabled(false);
    return reply.send({ stopped: true });
  });

  // POST /api/v1/autonomous-loop/trigger — manually trigger checks
  app.post('/api/v1/autonomous-loop/trigger', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const loop = getLoop();
    if (!loop) return reply.code(503).send({ error: 'Autonomous loop unavailable' });
    const { checkId } = req.body as { checkId?: string };
    const results = await loop.triggerManual(checkId);
    return reply.send({ results });
  });

  // GET /api/v1/autonomous-loop/results — get recent results
  app.get('/api/v1/autonomous-loop/results', { preHandler: [requireAuth] }, async (req, reply) => {
    const loop = getLoop();
    if (!loop) return reply.send({ results: [] });
    const count = Math.min(Number((req.query as { count?: string }).count ?? '50'), 200);
    return reply.send({ results: loop.getResults(count) });
  });

  // POST /api/v1/autonomous-loop/checks — add a custom check
  app.post('/api/v1/autonomous-loop/checks', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const loop = getLoop();
    if (!loop) return reply.code(503).send({ error: 'Autonomous loop unavailable' });
    const { id, name, description, prompt, severity } = req.body as {
      id: string;
      name: string;
      description: string;
      prompt: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    };
    if (!id || !name || !prompt) {
      return reply.code(400).send({ error: 'id, name, and prompt are required' });
    }
    loop.addCheck({ id, name, description, prompt, severity: severity ?? 'medium', enabled: true });
    return reply.send({ added: true, checkId: id });
  });

  // DELETE /api/v1/autonomous-loop/checks/:id — remove a check
  app.delete('/api/v1/autonomous-loop/checks/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const loop = getLoop();
    if (!loop) return reply.code(503).send({ error: 'Autonomous loop unavailable' });
    const { id } = req.params as { id: string };
    const removed = loop.removeCheck(id);
    return reply.send({ removed, checkId: id });
  });
};
