import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';
import { createProviderFromEnv, getGlobalWiring } from '@titan/agent-engine';
import {
  getSwarmEvolution,
  getRLEnvironment,
  getNormativeAgency,
  getTemporalIntelligence,
} from './module-instances.js';

export const statsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // === Evolution Stats ===

  app.get('/api/v1/evolution/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const wiring = getGlobalWiring();
    if (wiring?.metaEvolution) {
      const s = wiring.metaEvolution.getStats();
      return reply.send({ totalEvolutions: s.totalEvolutions, appliedEvolutions: s.appliedEvolutions, rolledBackEvolutions: s.rolledBackEvolutions, totalABTests: s.abTests, appliedTransfers: s.appliedTransfers });
    }
    return reply.send({ totalEvolutions: 0, appliedEvolutions: 0, rolledBackEvolutions: 0, totalABTests: 0, appliedTransfers: 0 });
  });

  // === Mirror Stats ===

  app.get('/api/v1/mirror/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const wiring = getGlobalWiring();
    if (wiring) {
      return reply.send({
        threads: wiring.innerMonologue.getActiveThreads(),
        threadCount: wiring.innerMonologue.getThreadCount(),
        lastNarrative: wiring.cognitiveController.getLastNarrative(),
        selfModel: wiring.cognitiveController.getLastSelfModel(),
        episodicItems: wiring.episodicBuffer.getItems(),
        episodicSize: wiring.episodicBuffer.getSize(),
        episodicCapacity: wiring.episodicBuffer.getCapacity(),
      });
    }
    return reply.send({ threads: [], threadCount: 0, lastNarrative: null, selfModel: null, episodicItems: [], episodicSize: 0, episodicCapacity: 7 });
  });

  // === World Model Stats ===

  app.get('/api/v1/world/graph/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const wiring = getGlobalWiring();
    if (wiring?.environmentGraph) {
      return reply.send(wiring.environmentGraph.stats());
    }
    return reply.send({ entities: 0, relations: 0, events: 0 });
  });

  app.post('/api/v1/world/simulate', { preHandler: [requireAuth] }, async (req, reply) => {
    const { scenario } = req.body as { scenario: string };
    if (!scenario) return reply.code(400).send({ error: 'scenario is required' });
    const wiring = getGlobalWiring();
    if (wiring?.worldSimulator) {
      try {
        const result = await wiring.worldSimulator.simulate(scenario, 'global');
        return reply.send(result);
      } catch {
        // fall through to stub
      }
    }
    return reply.send({ scenario, predictedOutcome: 'unknown', confidence: 0, similarPastEvents: [] });
  });

  app.get('/api/v1/digital-twin/state', { preHandler: [requireAuth] }, async (_req, reply) => {
    const wiring = getGlobalWiring();
    if (wiring?.digitalTwin) {
      return reply.send(wiring.digitalTwin.getState());
    }
    return reply.send({ snapshotCount: 0, entityCount: 0, relationCount: 0, lastSnapshot: null, trends: [], alerts: [] });
  });

  // === Swarm Evolution Stats ===

  app.get('/api/v1/swarm-evolution/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const swarm = getSwarmEvolution();
    const stats = swarm.getStats();
    return reply.send(stats);
  });

  // === RL / Economy Stats ===

  app.get('/api/v1/rl/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const rl = getRLEnvironment();
    const stats = rl.getStats();
    return reply.send(stats);
  });

  // === Normative / Constitution Stats ===

  app.get('/api/v1/normative/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const agency = getNormativeAgency();
    if (!agency) return reply.code(503).send({ error: 'LLM provider not configured' });
    const active = agency.getActiveCommitments();
    const conflicts = agency.getConflicts();
    return reply.send({
      total: active.length,
      active: active.filter(c => c.status === 'active').length,
      fulfilled: active.filter(c => c.status === 'fulfilled').length,
      violated: active.filter(c => c.status === 'violated').length,
      revised: active.filter(c => c.status === 'revised').length,
      conflicts: conflicts.length,
      revisions: 0,
    });
  });

  // === Translate ===

  app.post('/api/v1/reasoning/translate', { preHandler: [requireAuth] }, async (req, reply) => {
    const { text, targetLang } = req.body as { text: string; targetLang?: string };
    if (!text) return reply.code(400).send({ error: 'text is required' });
    const llm = createProviderFromEnv();
    if (!llm) return reply.code(503).send({ error: 'LLM provider not configured' });
    try {
      const response = await llm.complete([
        { role: 'system', content: `Translate the following text to ${targetLang ?? 'en'}. Return only the translation.` },
        { role: 'user', content: text },
      ], { temperature: 0.2, maxTokens: 2000 });
      return reply.send({ original: text, translated: response.content, targetLang: targetLang ?? 'en', status: 'ok' });
    } catch (err) {
      console.error('[reasoning] translation failed:', err);
      return reply.code(500).send({ error: 'Translation failed' });
    }
  });

  // === Temporal Analysis ===

  app.post('/api/v1/reasoning/temporal', { preHandler: [requireAuth] }, async (req, reply) => {
    const { text } = req.body as { text: string };
    if (!text) return reply.code(400).send({ error: 'text is required' });
    const temporal = getTemporalIntelligence();
    if (!temporal) return reply.code(503).send({ error: 'LLM provider not configured' });
    temporal.recordEvent(text, 'user-input');
    const events = temporal.getEvents();
    try {
      const { predictions, patterns } = await temporal.predictFuture();
      return reply.send({ input: text, analysis: 'temporal analysis complete', events: events.slice(-10), predictions, patterns });
    } catch {
      return reply.send({ input: text, analysis: 'temporal analysis complete', events: events.slice(-10), predictions: [], patterns: [] });
    }
  });
};
