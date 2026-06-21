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
  EmotionalIntelligence,
  NeuroSymbolicReasoner,
  DynamicToolDiscovery,
  AutonomousSkillSynthesis,
  MetaLearningOptimizer,
  TheoryOfMind,
  TestTimeRecursiveThinking,
  MetacognitiveConsolidation,
  SafetyGuardrail,
  SelfEvolvingSafetyMemory,
  HeuristicExtractor,
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
let emotionalIntelligence: EmotionalIntelligence | null = null;
let neuroSymbolicReasoner: NeuroSymbolicReasoner | null = null;
let toolDiscovery: DynamicToolDiscovery | null = null;
let skillSynthesis: AutonomousSkillSynthesis | null = null;
let metaLearningOptimizer: MetaLearningOptimizer | null = null;
let theoryOfMind: TheoryOfMind | null = null;
let trtModule: TestTimeRecursiveThinking | null = null;
let mcConsolidation: MetacognitiveConsolidation | null = null;
let safetyGuardrail: SafetyGuardrail | null = null;
let safetyMemory: SelfEvolvingSafetyMemory | null = null;
let heuristicExtractor: HeuristicExtractor | null = null;

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

function getEmotionalIntelligence(): EmotionalIntelligence | null {
  if (emotionalIntelligence) return emotionalIntelligence;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  emotionalIntelligence = new EmotionalIntelligence(llm);
  return emotionalIntelligence;
}

function getNeuroSymbolic(): NeuroSymbolicReasoner | null {
  if (neuroSymbolicReasoner) return neuroSymbolicReasoner;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  neuroSymbolicReasoner = new NeuroSymbolicReasoner(llm);
  return neuroSymbolicReasoner;
}

function getToolDiscovery(): DynamicToolDiscovery | null {
  if (toolDiscovery) return toolDiscovery;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  toolDiscovery = new DynamicToolDiscovery(llm);
  return toolDiscovery;
}

function getSkillSynthesis(): AutonomousSkillSynthesis | null {
  if (skillSynthesis) return skillSynthesis;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  skillSynthesis = new AutonomousSkillSynthesis(llm);
  return skillSynthesis;
}

function getMetaLearningOptimizer(): MetaLearningOptimizer | null {
  if (metaLearningOptimizer) return metaLearningOptimizer;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  metaLearningOptimizer = new MetaLearningOptimizer(llm);
  return metaLearningOptimizer;
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

  // === Emotional Intelligence ===

  // POST /api/v1/emotion/analyze — analyze emotion in a message
  app.post('/api/v1/emotion/analyze', { preHandler: [requireAuth] }, async (req, reply) => {
    const { message, userId, sessionId, conversationHistory } = req.body as {
      message: string;
      userId?: string;
      sessionId?: string;
      conversationHistory?: string[];
    };
    if (!message) return reply.code(400).send({ error: 'message is required' });
    const ei = getEmotionalIntelligence();
    if (!ei) return reply.code(503).send({ error: 'No LLM provider available' });
    const reading = await ei.analyze(message, { userId, sessionId, conversationHistory });
    return reply.send(reading);
  });

  // GET /api/v1/emotion/readings — get recent emotion readings
  app.get('/api/v1/emotion/readings', { preHandler: [requireAuth] }, async (req, reply) => {
    const { count } = req.query as { count?: string };
    const ei = getEmotionalIntelligence();
    if (!ei) return reply.send({ readings: [] });
    return reply.send({ readings: ei.getRecentReadings(count ? parseInt(count, 10) : 10) });
  });

  // GET /api/v1/emotion/profile/:userId — get user emotion profile
  app.get('/api/v1/emotion/profile/:userId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const ei = getEmotionalIntelligence();
    if (!ei) return reply.send({ avgValence: 0, avgArousal: 0, dominantEmotions: [], totalReadings: 0 });
    return reply.send(ei.getUserEmotionProfile(userId));
  });

  // GET /api/v1/emotion/stats — get emotion stats
  app.get('/api/v1/emotion/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ei = getEmotionalIntelligence();
    if (!ei) return reply.send({ totalReadings: 0, avgValence: 0, avgArousal: 0, avgEmpathy: 0, emotionDistribution: [], topStrategies: [] });
    return reply.send(ei.stats());
  });

  // === Neuro-Symbolic Reasoning ===

  // POST /api/v1/neuro-symbolic/reason — run neuro-symbolic reasoning
  app.post('/api/v1/neuro-symbolic/reason', { preHandler: [requireAuth] }, async (req, reply) => {
    const { query } = req.body as { query: string };
    if (!query) return reply.code(400).send({ error: 'query is required' });
    const ns = getNeuroSymbolic();
    if (!ns) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await ns.reason(query);
    return reply.send(result);
  });

  // POST /api/v1/neuro-symbolic/rules — add a symbolic rule
  app.post('/api/v1/neuro-symbolic/rules', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { name, condition, action, priority, active } = req.body as {
      name: string;
      condition: string;
      action: string;
      priority?: number;
      active?: boolean;
    };
    if (!name || !condition || !action) {
      return reply.code(400).send({ error: 'name, condition, and action are required' });
    }
    const ns = getNeuroSymbolic();
    if (!ns) return reply.code(503).send({ error: 'No LLM provider available' });
    const rule = ns.addRule({ name, condition, action, priority: priority ?? 5, active: active ?? true });
    return reply.send(rule);
  });

  // DELETE /api/v1/neuro-symbolic/rules/:id — remove a rule
  app.delete('/api/v1/neuro-symbolic/rules/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { id } = req.params as { id: string };
    const ns = getNeuroSymbolic();
    if (!ns) return reply.code(503).send({ error: 'No LLM provider available' });
    const success = ns.removeRule(id);
    return reply.send({ success });
  });

  // GET /api/v1/neuro-symbolic/rules — get all rules
  app.get('/api/v1/neuro-symbolic/rules', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ns = getNeuroSymbolic();
    if (!ns) return reply.send({ rules: [] });
    return reply.send({ rules: ns.getRules() });
  });

  // GET /api/v1/neuro-symbolic/results — get reasoning results
  app.get('/api/v1/neuro-symbolic/results', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ns = getNeuroSymbolic();
    if (!ns) return reply.send({ results: [] });
    return reply.send({ results: ns.getResults() });
  });

  // GET /api/v1/neuro-symbolic/stats — get neuro-symbolic stats
  app.get('/api/v1/neuro-symbolic/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ns = getNeuroSymbolic();
    if (!ns) return reply.send({ totalResults: 0, totalRules: 0, activeRules: 0, hybridCount: 0, neuralOnlyCount: 0, symbolicOnlyCount: 0, avgConfidence: 0 });
    return reply.send(ns.stats());
  });

  // === Dynamic Tool Discovery ===

  // POST /api/v1/tool-discovery/discover — discover tools for a task
  app.post('/api/v1/tool-discovery/discover', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { taskDescription, missingCapabilities } = req.body as {
      taskDescription: string;
      missingCapabilities?: string[];
    };
    if (!taskDescription) return reply.code(400).send({ error: 'taskDescription is required' });
    const td = getToolDiscovery();
    if (!td) return reply.code(503).send({ error: 'No LLM provider available' });
    const query = await td.discover(taskDescription, missingCapabilities);
    return reply.send(query);
  });

  // POST /api/v1/tool-discovery/install/:toolId — install a discovered tool
  app.post('/api/v1/tool-discovery/install/:toolId', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { toolId } = req.params as { toolId: string };
    const td = getToolDiscovery();
    if (!td) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await td.installTool(toolId);
    return reply.send(result);
  });

  // POST /api/v1/tool-discovery/uninstall/:toolId — uninstall a tool
  app.post('/api/v1/tool-discovery/uninstall/:toolId', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { toolId } = req.params as { toolId: string };
    const td = getToolDiscovery();
    if (!td) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await td.uninstallTool(toolId);
    return reply.send(result);
  });

  // GET /api/v1/tool-discovery/tools — get all discovered tools
  app.get('/api/v1/tool-discovery/tools', { preHandler: [requireAuth] }, async (_req, reply) => {
    const td = getToolDiscovery();
    if (!td) return reply.send({ tools: [] });
    return reply.send({ tools: td.getDiscoveredTools() });
  });

  // GET /api/v1/tool-discovery/installed — get installed tools
  app.get('/api/v1/tool-discovery/installed', { preHandler: [requireAuth] }, async (_req, reply) => {
    const td = getToolDiscovery();
    if (!td) return reply.send({ tools: [] });
    return reply.send({ tools: td.getInstalledTools() });
  });

  // GET /api/v1/tool-discovery/stats — get discovery stats
  app.get('/api/v1/tool-discovery/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const td = getToolDiscovery();
    if (!td) return reply.send({ totalDiscoveries: 0, installedTools: 0, verifiedTools: 0, bySource: [], byCategory: [], avgReliability: 0 });
    return reply.send(td.stats());
  });

  // === Autonomous Skill Synthesis ===

  // POST /api/v1/skill-synthesis/synthesize — synthesize a skill from a task
  app.post('/api/v1/skill-synthesis/synthesize', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { taskDescription } = req.body as { taskDescription: string };
    if (!taskDescription) return reply.code(400).send({ error: 'taskDescription is required' });
    const ss = getSkillSynthesis();
    if (!ss) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await ss.synthesize(taskDescription);
    return reply.send(result);
  });

  // GET /api/v1/skill-synthesis/skills — get all synthesized skills
  app.get('/api/v1/skill-synthesis/skills', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ss = getSkillSynthesis();
    if (!ss) return reply.send({ skills: [] });
    return reply.send({ skills: ss.getSkills() });
  });

  // GET /api/v1/skill-synthesis/verified — get verified skills only
  app.get('/api/v1/skill-synthesis/verified', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ss = getSkillSynthesis();
    if (!ss) return reply.send({ skills: [] });
    return reply.send({ skills: ss.getVerifiedSkills() });
  });

  // GET /api/v1/skill-synthesis/results — get synthesis results
  app.get('/api/v1/skill-synthesis/results', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ss = getSkillSynthesis();
    if (!ss) return reply.send({ results: [] });
    return reply.send({ results: ss.getResults() });
  });

  // GET /api/v1/skill-synthesis/stats — get synthesis stats
  app.get('/api/v1/skill-synthesis/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ss = getSkillSynthesis();
    if (!ss) return reply.send({ totalSkills: 0, verifiedSkills: 0, totalSyntheses: 0, successRate: 0, avgProficiency: 0, topSkills: [] });
    return reply.send(ss.stats());
  });

  // === Meta-Learning Optimizer ===

  // POST /api/v1/meta-learning/optimize — run meta-learning optimization
  app.post('/api/v1/meta-learning/optimize', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { performanceData } = req.body as { performanceData: Record<string, unknown> };
    if (!performanceData) return reply.code(400).send({ error: 'performanceData is required' });
    const ml = getMetaLearningOptimizer();
    if (!ml) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await ml.optimize(performanceData as any);
    return reply.send(result);
  });

  // GET /api/v1/meta-learning/config — get current learning config
  app.get('/api/v1/meta-learning/config', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ml = getMetaLearningOptimizer();
    if (!ml) return reply.send({ config: null });
    return reply.send({ config: ml.getConfig() });
  });

  // GET /api/v1/meta-learning/results — get optimization results
  app.get('/api/v1/meta-learning/results', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ml = getMetaLearningOptimizer();
    if (!ml) return reply.send({ results: [] });
    return reply.send({ results: ml.getResults() });
  });

  // GET /api/v1/meta-learning/stats — get meta-learning stats
  app.get('/api/v1/meta-learning/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ml = getMetaLearningOptimizer();
    if (!ml) return reply.send({ totalOptimizations: 0, currentLearningRate: 0, currentExplorationRate: 0, currentBatchSize: 0, strategyCount: 0, toolCount: 0, promptCount: 0, avgImprovement: 0, bestImprovement: 0 });
    return reply.send(ml.stats());
  });

  // === Theory of Mind ===

  function getTheoryOfMind(): TheoryOfMind | null {
    if (theoryOfMind) return theoryOfMind;
    const llm = createProviderFromEnv();
    if (!llm) return null;
    theoryOfMind = new TheoryOfMind(llm);
    return theoryOfMind;
  }

  app.post('/api/v1/tom/analyze', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { targetEntityId, entityType, messages, actions, background, currentTask } = req.body as {
      targetEntityId: string; entityType?: string; messages: Array<{ role: string; content: string }>;
      actions?: string[]; background?: string; currentTask?: string;
    };
    const tom = getTheoryOfMind();
    if (!tom) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await tom.analyze(targetEntityId, { entityType: entityType as any, messages, actions, background, currentTask });
    return reply.send(result);
  });

  app.get('/api/v1/tom/models', { preHandler: [requireAuth] }, async (_req, reply) => {
    const tom = getTheoryOfMind();
    if (!tom) return reply.send({ models: [] });
    return reply.send({ models: tom.getAllModels() });
  });

  app.get('/api/v1/tom/models/:entityId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { entityId } = req.params as { entityId: string };
    const tom = getTheoryOfMind();
    if (!tom) return reply.code(503).send({ error: 'No LLM provider available' });
    const model = tom.getModel(entityId);
    if (!model) return reply.code(404).send({ error: 'Model not found' });
    return reply.send(model);
  });

  app.get('/api/v1/tom/analyses', { preHandler: [requireAuth] }, async (req, reply) => {
    const { targetEntityId } = req.query as { targetEntityId?: string };
    const tom = getTheoryOfMind();
    if (!tom) return reply.send({ analyses: [] });
    return reply.send({ analyses: tom.getAnalyses(targetEntityId) });
  });

  app.get('/api/v1/tom/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const tom = getTheoryOfMind();
    if (!tom) return reply.send({ totalAnalyses: 0, avgConfidence: 0, trackedEntities: 0, predictionsMade: 0, correctPredictions: 0, accuracyRate: 0 });
    return reply.send(tom.stats());
  });

  // === Test-time Recursive Thinking ===

  function getTRT(): TestTimeRecursiveThinking | null {
    if (trtModule) return trtModule;
    const llm = createProviderFromEnv();
    if (!llm) return null;
    trtModule = new TestTimeRecursiveThinking(llm);
    return trtModule;
  }

  app.post('/api/v1/trt/solve', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { problem, maxRounds, strategies } = req.body as { problem: string; maxRounds?: number; strategies?: string[] };
    if (!problem) return reply.code(400).send({ error: 'problem is required' });
    const trt = getTRT();
    if (!trt) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await trt.solve(problem, { maxRounds, strategies });
    return reply.send(result);
  });

  app.get('/api/v1/trt/results', { preHandler: [requireAuth] }, async (_req, reply) => {
    const trt = getTRT();
    if (!trt) return reply.send({ results: [] });
    return reply.send({ results: trt.getResults() });
  });

  app.get('/api/v1/trt/knowledge', { preHandler: [requireAuth] }, async (_req, reply) => {
    const trt = getTRT();
    if (!trt) return reply.send({ knowledge: [] });
    return reply.send({ knowledge: trt.getGlobalKnowledge() });
  });

  app.get('/api/v1/trt/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const trt = getTRT();
    if (!trt) return reply.send({ totalProblems: 0, avgRounds: 0, convergenceRate: 0, avgConfidence: 0, totalKnowledgeGained: 0 });
    return reply.send(trt.stats());
  });

  // === Metacognitive Consolidation ===

  function getMCConsolidation(): MetacognitiveConsolidation | null {
    if (mcConsolidation) return mcConsolidation;
    const llm = createProviderFromEnv();
    if (!llm) return null;
    mcConsolidation = new MetacognitiveConsolidation(llm);
    return mcConsolidation;
  }

  app.post('/api/v1/mc/reflect', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { taskId, outcome, reasoningTrace } = req.body as { taskId: string; outcome: string; reasoningTrace: string };
    const mc = getMCConsolidation();
    if (!mc) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await mc.reflect(taskId, outcome as 'success' | 'failure', reasoningTrace);
    return reply.send(result);
  });

  app.post('/api/v1/mc/consolidate', { preHandler: [requireAuth] }, async (_req, reply) => {
    requirePermission(_req.auth, PERMISSIONS.TOOL_EXECUTE);
    const mc = getMCConsolidation();
    if (!mc) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await mc.consolidate();
    return reply.send(result);
  });

  app.post('/api/v1/mc/proceduralize', { preHandler: [requireAuth] }, async (_req, reply) => {
    requirePermission(_req.auth, PERMISSIONS.TOOL_EXECUTE);
    const mc = getMCConsolidation();
    if (!mc) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await mc.proceduralize();
    return reply.send(result);
  });

  app.post('/api/v1/mc/knowledge/relevant', { preHandler: [requireAuth] }, async (req, reply) => {
    const { taskDescription, topK } = req.body as { taskDescription: string; topK?: number };
    const mc = getMCConsolidation();
    if (!mc) return reply.send({ knowledge: [] });
    return reply.send({ knowledge: mc.getRelevantKnowledge(taskDescription, topK) });
  });

  app.get('/api/v1/mc/reflections', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mc = getMCConsolidation();
    if (!mc) return reply.send({ reflections: [] });
    return reply.send({ reflections: mc.getReflections() });
  });

  app.get('/api/v1/mc/meta-knowledge', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mc = getMCConsolidation();
    if (!mc) return reply.send({ knowledge: [] });
    return reply.send({ knowledge: mc.getMetaKnowledge() });
  });

  app.get('/api/v1/mc/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mc = getMCConsolidation();
    if (!mc) return reply.send({ totalReflections: 0, totalMicroLessons: 0, totalMetaKnowledge: 0, byCategory: [], avgConfidence: 0, lastConsolidation: null });
    return reply.send(mc.stats());
  });

  // === Safety Guardrail ===

  function getSafetyGuardrail(): SafetyGuardrail | null {
    if (safetyGuardrail) return safetyGuardrail;
    const llm = createProviderFromEnv();
    if (!llm) return null;
    safetyGuardrail = new SafetyGuardrail(llm);
    return safetyGuardrail;
  }

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

  function getSafetyMemory(): SelfEvolvingSafetyMemory {
    if (safetyMemory) return safetyMemory;
    safetyMemory = new SelfEvolvingSafetyMemory();
    return safetyMemory;
  }

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

  // === Heuristic Extractor ===

  function getHeuristicExtractor(): HeuristicExtractor | null {
    if (heuristicExtractor) return heuristicExtractor;
    const llm = createProviderFromEnv();
    if (!llm) return null;
    heuristicExtractor = new HeuristicExtractor(llm);
    return heuristicExtractor;
  }

  app.post('/api/v1/heuristics/extract', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { taskId, outcome, trajectory, taskType } = req.body as {
      taskId: string; outcome: string; trajectory: string; taskType?: string;
    };
    const he = getHeuristicExtractor();
    if (!he) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await he.extract(taskId, outcome as 'success' | 'failure', trajectory, taskType);
    return reply.send(result);
  });

  app.post('/api/v1/heuristics/retrieve', { preHandler: [requireAuth] }, async (req, reply) => {
    const { taskDescription, topK } = req.body as { taskDescription: string; topK?: number };
    const he = getHeuristicExtractor();
    if (!he) return reply.send({ matches: [] });
    return reply.send({ matches: he.retrieve(taskDescription, topK) });
  });

  app.get('/api/v1/heuristics', { preHandler: [requireAuth] }, async (_req, reply) => {
    const he = getHeuristicExtractor();
    if (!he) return reply.send({ heuristics: [] });
    return reply.send({ heuristics: he.getAllHeuristics() });
  });

  app.get('/api/v1/heuristics/extractions', { preHandler: [requireAuth] }, async (_req, reply) => {
    const he = getHeuristicExtractor();
    if (!he) return reply.send({ extractions: [] });
    return reply.send({ extractions: he.getExtractions() });
  });

  app.get('/api/v1/heuristics/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const he = getHeuristicExtractor();
    if (!he) return reply.send({ totalHeuristics: 0, fromSuccess: 0, fromFailure: 0, byCategory: [], byTaskType: [], avgConfidence: 0, avgSuccessRate: 0, totalUsage: 0 });
    return reply.send(he.stats());
  });
};
