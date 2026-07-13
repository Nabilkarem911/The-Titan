import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { experiences as experiencesRepo } from '@titan/database';
import { getDreamMode, getCausalReplay, getDebugger, getSelfRewriter, getEvolutionarySolver, getIntrospection } from './module-instances.js';
import type { BugReport } from '@titan/agent-engine';

export const dreamDebugRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // === Dream Mode ===

  app.post('/api/v1/dream/start', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { intervalMs } = req.body as { intervalMs?: number };
    const dm = getDreamMode();
    if (!dm) return reply.code(503).send({ error: 'No LLM provider available' });
    dm.start();
    return reply.send({ started: true, intervalMs: intervalMs ?? 1800000 });
  });

  app.post('/api/v1/dream/stop', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const dm = getDreamMode();
    if (!dm) return reply.code(503).send({ error: 'No LLM provider available' });
    dm.stop();
    return reply.send({ stopped: true });
  });

  app.post('/api/v1/dream/trigger', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { experiences: bodyExperiences, limit } = req.body as { experiences?: Array<Record<string, unknown>>; limit?: number };
    const dm = getDreamMode();
    if (!dm) return reply.code(503).send({ error: 'No LLM provider available' });

    if (bodyExperiences && bodyExperiences.length > 0) {
      const report = await dm.dreamWithData(bodyExperiences as any);
      return reply.send(report);
    }

    const dbExperiences = await experiencesRepo.getRecent(limit ?? 30);
    if (dbExperiences.length > 0) {
      const report = await dm.dreamFromExperiences(dbExperiences as any);
      return reply.send(report);
    }

    const report = await dm.dream();
    return reply.send(report);
  });

  app.get('/api/v1/dream/insights', { preHandler: [requireAuth] }, async (req, reply) => {
    const { type } = req.query as { type?: string };
    const dm = getDreamMode();
    if (!dm) return reply.send({ insights: [] });
    return reply.send({ insights: dm.getInsights(type as any) });
  });

  app.get('/api/v1/dream/reports', { preHandler: [requireAuth] }, async (_req, reply) => {
    const dm = getDreamMode();
    if (!dm) return reply.send({ reports: [] });
    return reply.send({ reports: dm.getReports() });
  });

  app.get('/api/v1/dream/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const dm = getDreamMode();
    if (!dm) return reply.send({ totalDreams: 0, totalInsights: 0, isDreaming: false, isRunning: false, avgInsightsPerDream: 0 });
    return reply.send(dm.stats());
  });

  // === Causal Replay ===

  app.post('/api/v1/causal-replay/analyze', { preHandler: [requireAuth] }, async (req, reply) => {
    const { run, budget } = req.body as { run: Record<string, unknown>; budget?: number };
    if (!run) return reply.code(400).send({ error: 'run is required' });

    const cr = getCausalReplay();
    if (!cr) return reply.code(503).send({ error: 'No LLM provider available' });

    const result = await cr.analyzeRun(run as any, budget ?? 5);
    return reply.send(result);
  });

  // === Self-Healing Debugger ===

  app.post('/api/v1/debug/analyze', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { filePath, errorType, errorMessage, stackTrace, context } = req.body as {
      filePath: string;
      errorType: string;
      errorMessage: string;
      stackTrace?: string;
      context?: string;
    };
    if (!filePath || !errorType || !errorMessage) {
      return reply.code(400).send({ error: 'filePath, errorType, and errorMessage are required' });
    }

    const dbg = getDebugger();
    if (!dbg) return reply.code(503).send({ error: 'No LLM provider available' });

    const bug: BugReport = {
      id: `bug-${Math.random().toString(36).slice(2, 10)}`,
      filePath,
      errorType,
      errorMessage,
      stackTrace,
      context,
      reportedAt: new Date(),
    };

    const result = await dbg.debug(bug);
    return reply.send(result);
  });

  app.get('/api/v1/debug/lessons', { preHandler: [requireAuth] }, async (_req, reply) => {
    const dbg = getDebugger();
    if (!dbg) return reply.send({ lessons: [] });
    return reply.send({ lessons: dbg.getLessons() });
  });

  app.get('/api/v1/debug/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const dbg = getDebugger();
    if (!dbg) return reply.send({ totalLessons: 0, totalAttempts: 0, successRate: 0 });
    return reply.send(dbg.stats());
  });

  // === Self-Rewriter ===

  app.post('/api/v1/self-rewrite/propose', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const sr = getSelfRewriter();
    if (!sr) return reply.code(503).send({ error: 'No LLM provider available' });
    const { recentPerformance } = req.body as { recentPerformance: Record<string, unknown> };
    const proposal = await sr.proposeImprovement(recentPerformance as any);
    return reply.send(proposal);
  });

  app.post('/api/v1/self-rewrite/apply', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const sr = getSelfRewriter();
    if (!sr) return reply.code(503).send({ error: 'No LLM provider available' });
    const { proposal } = req.body as { proposal: Record<string, unknown> };
    const result = await sr.evaluateAndApply(proposal as any);
    return reply.send(result);
  });

  app.post('/api/v1/self-rewrite/rollback', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const sr = getSelfRewriter();
    if (!sr) return reply.code(503).send({ error: 'No LLM provider available' });
    const { versionId } = req.body as { versionId: string };
    const success = sr.rollback(versionId);
    return reply.send({ success });
  });

  app.get('/api/v1/self-rewrite/versions', { preHandler: [requireAuth] }, async (_req, reply) => {
    const sr = getSelfRewriter();
    if (!sr) return reply.send({ versions: [] });
    return reply.send({ versions: sr.getVersions() });
  });

  app.get('/api/v1/self-rewrite/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const sr = getSelfRewriter();
    if (!sr) return reply.send({ totalVersions: 0, currentVersion: 0, currentPerformance: 0, appliedCount: 0, rolledBackCount: 0, improvementRate: 0 });
    return reply.send(sr.stats());
  });

  // === Evolutionary Solver ===

  app.post('/api/v1/evolution/solve', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const es = getEvolutionarySolver();
    if (!es) return reply.code(503).send({ error: 'No LLM provider available' });
    const { problem, populationSize, generations, eliteRatio, mutationRate } = req.body as {
      problem: string;
      populationSize?: number;
      generations?: number;
      eliteRatio?: number;
      mutationRate?: number;
    };
    if (!problem) return reply.code(400).send({ error: 'problem is required' });
    const result = await es.evolve(problem, { populationSize, generations, eliteRatio, mutationRate });
    return reply.send(result);
  });

  // === Introspection ===

  app.post('/api/v1/introspection/step', { preHandler: [requireAuth] }, async (req, reply) => {
    const { step, stepIndex } = req.body as { step: Record<string, unknown>; stepIndex: number };
    if (!step) return reply.code(400).send({ error: 'step is required' });
    const im = getIntrospection();
    if (!im) return reply.code(503).send({ error: 'No LLM provider available' });
    const report = await im.introspectStep(step as any, stepIndex ?? 0);
    return reply.send(report);
  });

  app.post('/api/v1/introspection/run', { preHandler: [requireAuth] }, async (req, reply) => {
    const { steps } = req.body as { steps: Array<Record<string, unknown>> };
    if (!steps || !Array.isArray(steps)) return reply.code(400).send({ error: 'steps array is required' });
    const im = getIntrospection();
    if (!im) return reply.code(503).send({ error: 'No LLM provider available' });
    const reports = await im.introspectRun(steps as any);
    return reply.send({ reports });
  });

  app.get('/api/v1/introspection/reports', { preHandler: [requireAuth] }, async (req, reply) => {
    const { count } = req.query as { count?: string };
    const im = getIntrospection();
    if (!im) return reply.send({ reports: [] });
    return reply.send({ reports: im.getRecentReports(count ? parseInt(count, 10) : 10) });
  });

  app.get('/api/v1/introspection/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const im = getIntrospection();
    if (!im) return reply.send({ totalIntrospections: 0, biasesDetected: 0, confabulationsDetected: 0, unusualStates: 0, avgConfidence: 0, topBiases: [] });
    return reply.send(im.stats());
  });
};
