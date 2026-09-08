import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import {
  getCuriosity,
  getEmotionalIntelligence,
  getNeuroSymbolic,
  getToolDiscovery,
  getSkillSynthesis,
  getMetaLearningOptimizer,
  getTheoryOfMind,
  getTRT,
  getMCConsolidation,
} from './module-instances.js';

export const cognitionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // === Curiosity Engine ===

  app.post('/api/v1/curiosity/start', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { intervalMs } = req.body as { intervalMs?: number };
    const ce = getCuriosity();
    if (!ce) return reply.code(503).send({ error: 'No LLM provider available' });
    ce.start();
    return reply.send({ started: true, intervalMs: intervalMs ?? 3600000 });
  });

  app.post('/api/v1/curiosity/stop', { preHandler: [requireAuth] }, async (_req, reply) => {
    requirePermission(_req.auth, PERMISSIONS.TOOL_EXECUTE);
    const ce = getCuriosity();
    if (!ce) return reply.code(503).send({ error: 'No LLM provider available' });
    ce.stop();
    return reply.send({ stopped: true });
  });

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

  app.get('/api/v1/curiosity/skills', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ce = getCuriosity();
    if (!ce) return reply.send({ skills: [] });
    return reply.send({ skills: ce.getSkills() });
  });

  app.get('/api/v1/curiosity/explorations', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ce = getCuriosity();
    if (!ce) return reply.send({ explorations: [] });
    return reply.send({ explorations: ce.getExplorations() });
  });

  app.get('/api/v1/curiosity/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ce = getCuriosity();
    if (!ce) return reply.send({ totalSkills: 0, totalExplorations: 0, successfulExplorations: 0, avgProficiency: 0, topSkills: [], isRunning: false, isExploring: false });
    return reply.send(ce.stats());
  });

  // === Emotional Intelligence ===

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

  app.get('/api/v1/emotion/readings', { preHandler: [requireAuth] }, async (req, reply) => {
    const { count } = req.query as { count?: string };
    const ei = getEmotionalIntelligence();
    if (!ei) return reply.send({ readings: [] });
    return reply.send({ readings: ei.getRecentReadings(count ? parseInt(count, 10) : 10) });
  });

  app.get('/api/v1/emotion/profile/:userId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const ei = getEmotionalIntelligence();
    if (!ei) return reply.send({ avgValence: 0, avgArousal: 0, dominantEmotions: [], totalReadings: 0 });
    return reply.send(ei.getUserEmotionProfile(userId));
  });

  app.get('/api/v1/emotion/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ei = getEmotionalIntelligence();
    if (!ei) return reply.send({ totalReadings: 0, avgValence: 0, avgArousal: 0, avgEmpathy: 0, emotionDistribution: [], topStrategies: [] });
    return reply.send(ei.stats());
  });

  // === Neuro-Symbolic Reasoning ===

  app.post('/api/v1/neuro-symbolic/reason', { preHandler: [requireAuth] }, async (req, reply) => {
    const { query } = req.body as { query: string };
    if (!query) return reply.code(400).send({ error: 'query is required' });
    const ns = getNeuroSymbolic();
    if (!ns) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await ns.reason(query);
    return reply.send(result);
  });

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

  app.delete('/api/v1/neuro-symbolic/rules/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { id } = req.params as { id: string };
    const ns = getNeuroSymbolic();
    if (!ns) return reply.code(503).send({ error: 'No LLM provider available' });
    const success = ns.removeRule(id);
    return reply.send({ success });
  });

  app.get('/api/v1/neuro-symbolic/rules', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ns = getNeuroSymbolic();
    if (!ns) return reply.send({ rules: [] });
    return reply.send({ rules: ns.getRules() });
  });

  app.get('/api/v1/neuro-symbolic/results', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ns = getNeuroSymbolic();
    if (!ns) return reply.send({ results: [] });
    return reply.send({ results: ns.getResults() });
  });

  app.get('/api/v1/neuro-symbolic/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ns = getNeuroSymbolic();
    if (!ns) return reply.send({ totalResults: 0, totalRules: 0, activeRules: 0, hybridCount: 0, neuralOnlyCount: 0, symbolicOnlyCount: 0, avgConfidence: 0 });
    return reply.send(ns.stats());
  });

  // === Dynamic Tool Discovery ===

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

  app.post('/api/v1/tool-discovery/install/:toolId', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { toolId } = req.params as { toolId: string };
    const td = getToolDiscovery();
    if (!td) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await td.installTool(toolId);
    return reply.send(result);
  });

  app.post('/api/v1/tool-discovery/uninstall/:toolId', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { toolId } = req.params as { toolId: string };
    const td = getToolDiscovery();
    if (!td) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await td.uninstallTool(toolId);
    return reply.send(result);
  });

  app.get('/api/v1/tool-discovery/tools', { preHandler: [requireAuth] }, async (_req, reply) => {
    const td = getToolDiscovery();
    if (!td) return reply.send({ tools: [] });
    return reply.send({ tools: td.getDiscoveredTools() });
  });

  app.get('/api/v1/tool-discovery/installed', { preHandler: [requireAuth] }, async (_req, reply) => {
    const td = getToolDiscovery();
    if (!td) return reply.send({ tools: [] });
    return reply.send({ tools: td.getInstalledTools() });
  });

  app.get('/api/v1/tool-discovery/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const td = getToolDiscovery();
    if (!td) return reply.send({ totalDiscoveries: 0, installedTools: 0, verifiedTools: 0, bySource: [], byCategory: [], avgReliability: 0 });
    return reply.send(td.stats());
  });

  // === Autonomous Skill Synthesis ===

  app.post('/api/v1/skill-synthesis/synthesize', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { taskDescription } = req.body as { taskDescription: string };
    if (!taskDescription) return reply.code(400).send({ error: 'taskDescription is required' });
    const ss = getSkillSynthesis();
    if (!ss) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await ss.synthesize(taskDescription);
    return reply.send(result);
  });

  app.get('/api/v1/skill-synthesis/skills', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ss = getSkillSynthesis();
    if (!ss) return reply.send({ skills: [] });
    return reply.send({ skills: ss.getSkills() });
  });

  app.get('/api/v1/skill-synthesis/verified', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ss = getSkillSynthesis();
    if (!ss) return reply.send({ skills: [] });
    return reply.send({ skills: ss.getVerifiedSkills() });
  });

  app.get('/api/v1/skill-synthesis/results', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ss = getSkillSynthesis();
    if (!ss) return reply.send({ results: [] });
    return reply.send({ results: ss.getResults() });
  });

  app.get('/api/v1/skill-synthesis/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ss = getSkillSynthesis();
    if (!ss) return reply.send({ totalSkills: 0, verifiedSkills: 0, totalSyntheses: 0, successRate: 0, avgProficiency: 0, topSkills: [] });
    return reply.send(ss.stats());
  });

  // === Meta-Learning Optimizer ===

  app.post('/api/v1/meta-learning/optimize', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { performanceData } = req.body as { performanceData: Record<string, unknown> };
    if (!performanceData) return reply.code(400).send({ error: 'performanceData is required' });
    const ml = getMetaLearningOptimizer();
    if (!ml) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await ml.optimize(performanceData as unknown as Parameters<typeof ml.optimize>[0]);
    return reply.send(result);
  });

  app.get('/api/v1/meta-learning/config', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ml = getMetaLearningOptimizer();
    if (!ml) return reply.send({ config: null });
    return reply.send({ config: ml.getConfig() });
  });

  app.get('/api/v1/meta-learning/results', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ml = getMetaLearningOptimizer();
    if (!ml) return reply.send({ results: [] });
    return reply.send({ results: ml.getResults() });
  });

  app.get('/api/v1/meta-learning/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ml = getMetaLearningOptimizer();
    if (!ml) return reply.send({ totalOptimizations: 0, currentLearningRate: 0, currentExplorationRate: 0, currentBatchSize: 0, strategyCount: 0, toolCount: 0, promptCount: 0, avgImprovement: 0, bestImprovement: 0 });
    return reply.send(ml.stats());
  });

  // === Theory of Mind ===

  app.post('/api/v1/tom/analyze', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { targetEntityId, entityType, messages, actions, background, currentTask } = req.body as {
      targetEntityId: string; entityType?: string; messages: Array<{ role: string; content: string }>;
      actions?: string[]; background?: string; currentTask?: string;
    };
    const tom = getTheoryOfMind();
    if (!tom) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await tom.analyze(targetEntityId, { entityType: entityType as unknown as Parameters<typeof tom.analyze>[1]['entityType'], messages, actions, background, currentTask });
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

  app.post('/api/v1/trt/solve', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { problem, maxRounds, strategies, fastSolverFirst } = req.body as { problem: string; maxRounds?: number; strategies?: string[]; fastSolverFirst?: boolean };
    if (!problem) return reply.code(400).send({ error: 'problem is required' });
    const trt = getTRT();
    if (!trt) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await trt.solve(problem, { maxRounds, strategies, fastSolverFirst });
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
    if (!trt) return reply.send({ totalProblems: 0, avgRounds: 0, convergenceRate: 0, avgConfidence: 0, totalKnowledgeGained: 0, abstentionRate: 0, fastSolverUsage: 0, slowSolverUsage: 0 });
    return reply.send(trt.stats());
  });

  // === Metacognitive Consolidation ===

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
};
