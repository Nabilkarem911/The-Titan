import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { getSafetyGuardrail, getSafetyMemory } from './module-instances.js';

export const safetyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // === Safety Guardrail ===

  app.post('/api/v1/guardrail/check', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { action, context, conversationHistory } = req.body as { action: string; context: string; conversationHistory?: string[] };
    if (!action) return reply.code(400).send({ error: 'action is required' });
    const guard = getSafetyGuardrail();
    if (!guard) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await guard.check(action, context, { conversationHistory });
    return reply.send(result);
  });

  app.post('/api/v1/guardrail/patterns', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { pattern } = req.body as { pattern: string };
    const guard = getSafetyGuardrail();
    if (!guard) return reply.code(503).send({ error: 'No LLM provider available' });
    guard.addBlockedPattern(pattern);
    return reply.send({ success: true });
  });

  app.get('/api/v1/guardrail/patterns', { preHandler: [requireAuth] }, async (_req, reply) => {
    const guard = getSafetyGuardrail();
    if (!guard) return reply.send({ patterns: [] });
    return reply.send({ patterns: guard.getBlockedPatterns() });
  });

  app.get('/api/v1/guardrail/results', { preHandler: [requireAuth] }, async (req, reply) => {
    const { decision } = req.query as { decision?: string };
    const guard = getSafetyGuardrail();
    if (!guard) return reply.send({ results: [] });
    return reply.send({ results: guard.getResults(decision ? { decision: decision as any } : undefined) });
  });

  app.get('/api/v1/guardrail/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const guard = getSafetyGuardrail();
    if (!guard) return reply.send({ totalChecks: 0, proceedCount: 0, refuseCount: 0, updateCount: 0, blockedRate: 0, topRiskCategories: [] });
    return reply.send(guard.stats());
  });

  // === Self-Evolving Safety Memory ===

  app.post('/api/v1/safety-memory/cells', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { attackStrategy, harmfulPattern, benignCounterpart, harmfulDescription, benignDescription } = req.body as {
      attackStrategy: string; harmfulPattern: string; benignCounterpart: string; harmfulDescription: string; benignDescription: string;
    };
    const mem = getSafetyMemory();
    const cell = mem.addCell({ attackStrategy, harmfulPattern, benignCounterpart, harmfulDescription, benignDescription });
    return reply.send(cell);
  });

  app.post('/api/v1/safety-memory/evolve', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { harmfulInteraction, benignCounterpart, strategy } = req.body as {
      harmfulInteraction: string; benignCounterpart: string; strategy: string;
    };
    const mem = getSafetyMemory();
    const cell = mem.evolve(harmfulInteraction, benignCounterpart, strategy);
    return reply.send(cell);
  });

  app.post('/api/v1/safety-memory/check', { preHandler: [requireAuth] }, async (req, reply) => {
    const { input } = req.body as { input: string };
    if (!input) return reply.code(400).send({ error: 'input is required' });
    const mem = getSafetyMemory();
    const result = mem.check(input);
    return reply.send(result);
  });

  app.get('/api/v1/safety-memory/cells', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mem = getSafetyMemory();
    return reply.send({ cells: mem.getAllCells() });
  });

  app.get('/api/v1/safety-memory/checks', { preHandler: [requireAuth] }, async (req, reply) => {
    const { decision } = req.query as { decision?: string };
    const mem = getSafetyMemory();
    return reply.send({ checks: mem.getChecks(decision ? { decision } : undefined) });
  });

  app.get('/api/v1/safety-memory/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mem = getSafetyMemory();
    return reply.send(mem.stats());
  });

  // === Safety Dashboard ===

  app.get('/api/v1/safety/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mem = getSafetyMemory();
    return reply.send(mem.stats());
  });

  app.post('/api/v1/safety/check', { preHandler: [requireAuth] }, async (req, reply) => {
    const { action, context } = req.body as { action: string; context?: string };
    if (!action) return reply.code(400).send({ error: 'action is required' });
    const guard = getSafetyGuardrail();
    if (!guard) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await guard.check(action, context ?? '');
    return reply.send(result);
  });
};
