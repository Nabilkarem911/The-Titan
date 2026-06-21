import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import {
  DreamMode,
  CausalReplay,
  SelfHealingDebugger,
  SelfRewriter,
  EvolutionarySolver,
  IntrospectionModule,
  CuriosityEngine,
  createProviderFromEnv,
  type BugReport,
} from '@titan/agent-engine';

let dreamMode: DreamMode | null = null;
let causalReplay: CausalReplay | null = null;
let debugger_: SelfHealingDebugger | null = null;
let selfRewriter: SelfRewriter | null = null;
let evolutionarySolver: EvolutionarySolver | null = null;
let introspectionModule: IntrospectionModule | null = null;
let curiosityEngine: CuriosityEngine | null = null;

function getDreamMode(): DreamMode | null {
  if (dreamMode) return dreamMode;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  dreamMode = new DreamMode(llm);
  return dreamMode;
}

function getCausalReplay(): CausalReplay | null {
  if (causalReplay) return causalReplay;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  causalReplay = new CausalReplay(llm);
  return causalReplay;
}

function getDebugger(): SelfHealingDebugger | null {
  if (debugger_) return debugger_;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  debugger_ = new SelfHealingDebugger(llm);
  return debugger_;
}

function getSelfRewriter(): SelfRewriter | null {
  if (selfRewriter) return selfRewriter;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  selfRewriter = new SelfRewriter(llm);
  return selfRewriter;
}

function getEvolutionarySolver(): EvolutionarySolver | null {
  if (evolutionarySolver) return evolutionarySolver;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  evolutionarySolver = new EvolutionarySolver(llm);
  return evolutionarySolver;
}

function getIntrospection(): IntrospectionModule | null {
  if (introspectionModule) return introspectionModule;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  introspectionModule = new IntrospectionModule(llm);
  return introspectionModule;
}

function getCuriosity(): CuriosityEngine | null {
  if (curiosityEngine) return curiosityEngine;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  curiosityEngine = new CuriosityEngine(llm);
  return curiosityEngine;
}

export const reasoningRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // === Dream Mode ===

  // POST /api/v1/dream/start — start dream mode background timer
  app.post('/api/v1/dream/start', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { intervalMs } = req.body as { intervalMs?: number };
    const dm = getDreamMode();
    if (!dm) return reply.code(503).send({ error: 'No LLM provider available' });
    dm.start();
    return reply.send({ started: true, intervalMs: intervalMs ?? 1800000 });
  });

  // POST /api/v1/dream/stop — stop dream mode
  app.post('/api/v1/dream/stop', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const dm = getDreamMode();
    if (!dm) return reply.code(503).send({ error: 'No LLM provider available' });
    dm.stop();
    return reply.send({ stopped: true });
  });

  // POST /api/v1/dream/trigger — manually trigger a dream session
  app.post('/api/v1/dream/trigger', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { experiences } = req.body as { experiences?: Array<Record<string, unknown>> };
    const dm = getDreamMode();
    if (!dm) return reply.code(503).send({ error: 'No LLM provider available' });

    if (experiences && experiences.length > 0) {
      const report = await dm.dreamWithData(experiences as any);
      return reply.send(report);
    }

    const report = await dm.dream();
    return reply.send(report);
  });

  // GET /api/v1/dream/insights — get dream insights
  app.get('/api/v1/dream/insights', { preHandler: [requireAuth] }, async (req, reply) => {
    const { type } = req.query as { type?: string };
    const dm = getDreamMode();
    if (!dm) return reply.send({ insights: [] });
    return reply.send({ insights: dm.getInsights(type as any) });
  });

  // GET /api/v1/dream/reports — get dream reports
  app.get('/api/v1/dream/reports', { preHandler: [requireAuth] }, async (_req, reply) => {
    const dm = getDreamMode();
    if (!dm) return reply.send({ reports: [] });
    return reply.send({ reports: dm.getReports() });
  });

  // GET /api/v1/dream/stats — get dream stats
  app.get('/api/v1/dream/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const dm = getDreamMode();
    if (!dm) return reply.send({ totalDreams: 0, totalInsights: 0, isDreaming: false, isRunning: false, avgInsightsPerDream: 0 });
    return reply.send(dm.stats());
  });

  // === Causal Replay ===

  // POST /api/v1/causal-replay/analyze — analyze which step caused a failure
  app.post('/api/v1/causal-replay/analyze', { preHandler: [requireAuth] }, async (req, reply) => {
    const { run, budget } = req.body as { run: Record<string, unknown>; budget?: number };
    if (!run) return reply.code(400).send({ error: 'run is required' });

    const cr = getCausalReplay();
    if (!cr) return reply.code(503).send({ error: 'No LLM provider available' });

    const result = await cr.analyzeRun(run as any, budget ?? 5);
    return reply.send(result);
  });

  // === Self-Healing Debugger ===

  // POST /api/v1/debug/analyze — debug a bug
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

  // GET /api/v1/debug/lessons — get historical lessons
  app.get('/api/v1/debug/lessons', { preHandler: [requireAuth] }, async (_req, reply) => {
    const dbg = getDebugger();
    if (!dbg) return reply.send({ lessons: [] });
    return reply.send({ lessons: dbg.getLessons() });
  });

  // GET /api/v1/debug/stats — get debugger stats
  app.get('/api/v1/debug/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const dbg = getDebugger();
    if (!dbg) return reply.send({ totalLessons: 0, totalAttempts: 0, successRate: 0 });
    return reply.send(dbg.stats());
  });

  // === Self-Rewriter ===

  // POST /api/v1/self-rewrite/propose — propose a self-improvement
  app.post('/api/v1/self-rewrite/propose', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const sr = getSelfRewriter();
    if (!sr) return reply.code(503).send({ error: 'No LLM provider available' });
    const { recentPerformance } = req.body as { recentPerformance: Record<string, unknown> };
    const proposal = await sr.proposeImprovement(recentPerformance as any);
    return reply.send(proposal);
  });

  // POST /api/v1/self-rewrite/apply — evaluate and apply a proposal
  app.post('/api/v1/self-rewrite/apply', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const sr = getSelfRewriter();
    if (!sr) return reply.code(503).send({ error: 'No LLM provider available' });
    const { proposal } = req.body as { proposal: Record<string, unknown> };
    const result = await sr.evaluateAndApply(proposal as any);
    return reply.send(result);
  });

  // POST /api/v1/self-rewrite/rollback — rollback a version
  app.post('/api/v1/self-rewrite/rollback', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const sr = getSelfRewriter();
    if (!sr) return reply.code(503).send({ error: 'No LLM provider available' });
    const { versionId } = req.body as { versionId: string };
    const success = sr.rollback(versionId);
    return reply.send({ success });
  });

  // GET /api/v1/self-rewrite/versions — get all versions
  app.get('/api/v1/self-rewrite/versions', { preHandler: [requireAuth] }, async (_req, reply) => {
    const sr = getSelfRewriter();
    if (!sr) return reply.send({ versions: [] });
    return reply.send({ versions: sr.getVersions() });
  });

  // GET /api/v1/self-rewrite/stats — get rewriter stats
  app.get('/api/v1/self-rewrite/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const sr = getSelfRewriter();
    if (!sr) return reply.send({ totalVersions: 0, currentVersion: 0, currentPerformance: 0, appliedCount: 0, rolledBackCount: 0, improvementRate: 0 });
    return reply.send(sr.stats());
  });

  // === Evolutionary Solver ===

  // POST /api/v1/evolution/solve — evolve solutions for a problem
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

  // POST /api/v1/introspection/step — introspect a single step
  app.post('/api/v1/introspection/step', { preHandler: [requireAuth] }, async (req, reply) => {
    const { step, stepIndex } = req.body as { step: Record<string, unknown>; stepIndex: number };
    if (!step) return reply.code(400).send({ error: 'step is required' });
    const im = getIntrospection();
    if (!im) return reply.code(503).send({ error: 'No LLM provider available' });
    const report = await im.introspectStep(step as any, stepIndex ?? 0);
    return reply.send(report);
  });

  // POST /api/v1/introspection/run — introspect all steps in a run
  app.post('/api/v1/introspection/run', { preHandler: [requireAuth] }, async (req, reply) => {
    const { steps } = req.body as { steps: Array<Record<string, unknown>> };
    if (!steps || !Array.isArray(steps)) return reply.code(400).send({ error: 'steps array is required' });
    const im = getIntrospection();
    if (!im) return reply.code(503).send({ error: 'No LLM provider available' });
    const reports = await im.introspectRun(steps as any);
    return reply.send({ reports });
  });

  // GET /api/v1/introspection/reports — get recent introspection reports
  app.get('/api/v1/introspection/reports', { preHandler: [requireAuth] }, async (req, reply) => {
    const { count } = req.query as { count?: string };
    const im = getIntrospection();
    if (!im) return reply.send({ reports: [] });
    return reply.send({ reports: im.getRecentReports(count ? parseInt(count, 10) : 10) });
  });

  // GET /api/v1/introspection/stats — get introspection stats
  app.get('/api/v1/introspection/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const im = getIntrospection();
    if (!im) return reply.send({ totalIntrospections: 0, biasesDetected: 0, confabulationsDetected: 0, unusualStates: 0, avgConfidence: 0, topBiases: [] });
    return reply.send(im.stats());
  });

  // === Curiosity Engine ===

  // POST /api/v1/curiosity/start — start curiosity engine
  app.post('/api/v1/curiosity/start', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { intervalMs } = req.body as { intervalMs?: number };
    const ce = getCuriosity();
    if (!ce) return reply.code(503).send({ error: 'No LLM provider available' });
    ce.start();
    return reply.send({ started: true, intervalMs: intervalMs ?? 3600000 });
  });

  // POST /api/v1/curiosity/stop — stop curiosity engine
  app.post('/api/v1/curiosity/stop', { preHandler: [requireAuth] }, async (_req, reply) => {
    requirePermission(_req.auth, PERMISSIONS.TOOL_EXECUTE);
    const ce = getCuriosity();
    if (!ce) return reply.code(503).send({ error: 'No LLM provider available' });
    ce.stop();
    return reply.send({ stopped: true });
  });

  // POST /api/v1/curiosity/explore — manually trigger exploration
  app.post('/api/v1/curiosity/explore', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const ce = getCuriosity();
    if (!ce) return reply.code(503).send({ error: 'No LLM provider available' });
    const { topic } = req.body as { topic?: string };
    if (topic) {
      const result = await ce.exploreTopic(topic);
      return reply.send(result);
    }
    const result = await ce.exploreNext();
    return reply.send(result);
  });

  // GET /api/v1/curiosity/skills — get acquired skills
  app.get('/api/v1/curiosity/skills', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ce = getCuriosity();
    if (!ce) return reply.send({ skills: [] });
    return reply.send({ skills: ce.getSkills() });
  });

  // GET /api/v1/curiosity/explorations — get exploration history
  app.get('/api/v1/curiosity/explorations', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ce = getCuriosity();
    if (!ce) return reply.send({ explorations: [] });
    return reply.send({ explorations: ce.getExplorations() });
  });

  // GET /api/v1/curiosity/stats — get curiosity stats
  app.get('/api/v1/curiosity/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ce = getCuriosity();
    if (!ce) return reply.send({ totalSkills: 0, totalExplorations: 0, successfulExplorations: 0, avgProficiency: 0, topSkills: [], isRunning: false, isExploring: false });
    return reply.send(ce.stats());
  });
};
