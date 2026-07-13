import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import {
  getHeuristicExtractor,
  getHyperAgent,
  getExecutionStateMemory,
  getSmartModelRouter,
  getBenchmarkingSuite,
  getWebMCPBridge,
} from './module-instances.js';

export const infrastructureRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // === Heuristic Extractor ===

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

  // === HyperAgent ===

  app.post('/api/v1/hyper-agent/cycle', { preHandler: [requireAuth] }, async (_req, reply) => {
    requirePermission(_req.auth, PERMISSIONS.TOOL_EXECUTE);
    const ha = getHyperAgent();
    if (!ha) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await ha.runCycle();
    return reply.send(result);
  });

  app.post('/api/v1/hyper-agent/start', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { intervalMs } = req.body as { intervalMs?: number };
    const ha = getHyperAgent();
    if (!ha) return reply.code(503).send({ error: 'No LLM provider available' });
    ha.start(intervalMs);
    return reply.send({ running: true });
  });

  app.post('/api/v1/hyper-agent/stop', { preHandler: [requireAuth] }, async (_req, reply) => {
    requirePermission(_req.auth, PERMISSIONS.TOOL_EXECUTE);
    const ha = getHyperAgent();
    if (!ha) return reply.code(503).send({ error: 'No LLM provider available' });
    ha.stop();
    return reply.send({ running: false });
  });

  app.get('/api/v1/hyper-agent/cycles', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ha = getHyperAgent();
    if (!ha) return reply.send({ cycles: [] });
    return reply.send({ cycles: ha.getCycles() });
  });

  app.get('/api/v1/hyper-agent/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const ha = getHyperAgent();
    if (!ha) return reply.send({ totalCycles: 0, totalImprovements: 0, keptImprovements: 0, rolledBackImprovements: 0, avgGain: 0, bestGain: 0, currentPerformance: 0, improvementHistory: [] });
    return reply.send(ha.stats());
  });

  // === Execution State Memory ===

  app.post('/api/v1/esm/checkpoint', { preHandler: [requireAuth] }, async (req, reply) => {
    const { runId, stepIndex, stepCount, state, metadata } = req.body as {
      runId: string; stepIndex: number; stepCount: number;
      state: { messages: Array<{ role: string; content: string }>; toolResults: Array<{ tool: string; result: unknown }>; plan: string[]; variables: Record<string, unknown>; intermediateResults: unknown[] };
      metadata?: Record<string, unknown>;
    };
    const esm = getExecutionStateMemory();
    const cp = esm.checkpoint(runId, stepIndex, stepCount, state, metadata);
    return reply.send(cp);
  });

  app.post('/api/v1/esm/resume/:checkpointId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { checkpointId } = req.params as { checkpointId: string };
    const esm = getExecutionStateMemory();
    const cp = esm.resume(checkpointId);
    if (!cp) return reply.code(404).send({ error: 'Checkpoint not found' });
    return reply.send(cp);
  });

  app.get('/api/v1/esm/checkpoints/:runId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    const esm = getExecutionStateMemory();
    return reply.send({ checkpoints: esm.getRunCheckpoints(runId) });
  });

  app.get('/api/v1/esm/latest/:runId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    const esm = getExecutionStateMemory();
    const cp = esm.getLatestCheckpoint(runId);
    if (!cp) return reply.code(404).send({ error: 'No checkpoints found' });
    return reply.send(cp);
  });

  app.post('/api/v1/esm/complete/:runId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    const esm = getExecutionStateMemory();
    esm.markCompleted(runId);
    return reply.send({ success: true });
  });

  app.get('/api/v1/esm/active-runs', { preHandler: [requireAuth] }, async (_req, reply) => {
    const esm = getExecutionStateMemory();
    return reply.send({ activeRuns: esm.getActiveRuns() });
  });

  app.get('/api/v1/esm/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const esm = getExecutionStateMemory();
    return reply.send(esm.stats());
  });

  // === Smart Model Router ===

  app.post('/api/v1/router/route', { preHandler: [requireAuth] }, async (req, reply) => {
    const { input, taskType, maxLatencyMs, maxCost, requiredCapabilities, preferTier } = req.body as {
      input: string; taskType?: string; maxLatencyMs?: number; maxCost?: number; requiredCapabilities?: string[]; preferTier?: string;
    };
    try {
      const router = getSmartModelRouter();
      const decision = router.route(input, { taskType, maxLatencyMs, maxCost, requiredCapabilities, preferTier: preferTier as any });
      return reply.send(decision);
    } catch (err) {
      return reply.code(500).send({ error: 'Router failed', detail: String(err) });
    }
  });

  app.get('/api/v1/router/models', { preHandler: [requireAuth] }, async (_req, reply) => {
    const router = getSmartModelRouter();
    return reply.send({ models: router.getModels() });
  });

  app.post('/api/v1/router/models', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const router = getSmartModelRouter();
    router.addModel(req.body as any);
    return reply.send({ success: true });
  });

  app.get('/api/v1/router/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const router = getSmartModelRouter();
    return reply.send(router.stats());
  });

  // === Benchmarking Suite ===

  app.post('/api/v1/benchmark/run', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { suiteName, categories, difficulties } = req.body as { suiteName?: string; categories?: string[]; difficulties?: string[] };
    const bs = getBenchmarkingSuite();
    if (!bs) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await bs.runSuite(suiteName ?? 'default', undefined, { categories, difficulties });
    return reply.send(result);
  });

  app.get('/api/v1/benchmark/tasks', { preHandler: [requireAuth] }, async (_req, reply) => {
    const bs = getBenchmarkingSuite();
    if (!bs) return reply.send({ tasks: [] });
    return reply.send({ tasks: bs.getDefaultTasks() });
  });

  app.post('/api/v1/benchmark/tasks', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const bs = getBenchmarkingSuite();
    if (!bs) return reply.code(503).send({ error: 'No LLM provider available' });
    bs.addCustomTask(req.body as any);
    return reply.send({ success: true });
  });

  app.get('/api/v1/benchmark/suites', { preHandler: [requireAuth] }, async (_req, reply) => {
    const bs = getBenchmarkingSuite();
    if (!bs) return reply.send({ suites: [] });
    return reply.send({ suites: bs.getSuites() });
  });

  app.get('/api/v1/benchmark/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const bs = getBenchmarkingSuite();
    if (!bs) return reply.send({ totalSuites: 0, totalTasks: 0, totalPassed: 0, passRate: 0, avgScore: 0, byCategory: [], byDifficulty: [], recentSuites: [] });
    return reply.send(bs.stats());
  });

  // === WebMCP Bridge ===

  app.post('/api/v1/webmcp/servers', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { name, url, protocolVersion, capabilities } = req.body as { name: string; url: string; protocolVersion?: string; capabilities?: string[] };
    const bridge = getWebMCPBridge();
    const server = bridge.registerServer({ name, url, protocolVersion, capabilities });
    return reply.send(server);
  });

  app.delete('/api/v1/webmcp/servers/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { id } = req.params as { id: string };
    const bridge = getWebMCPBridge();
    const removed = bridge.unregisterServer(id);
    return reply.send({ success: removed });
  });

  app.get('/api/v1/webmcp/servers', { preHandler: [requireAuth] }, async (_req, reply) => {
    const bridge = getWebMCPBridge();
    return reply.send({ servers: bridge.getServers() });
  });

  app.post('/api/v1/webmcp/servers/:id/discover', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { id } = req.params as { id: string };
    const bridge = getWebMCPBridge();
    const tools = await bridge.discoverTools(id);
    return reply.send({ tools });
  });

  app.post('/api/v1/webmcp/invoke', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { serverId, toolName, input } = req.body as { serverId: string; toolName: string; input: Record<string, unknown> };
    const bridge = getWebMCPBridge();
    const result = await bridge.invokeTool(serverId, toolName, input);
    return reply.send(result);
  });

  app.post('/api/v1/webmcp/ping/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const bridge = getWebMCPBridge();
    const alive = await bridge.pingServer(id);
    return reply.send({ alive });
  });

  app.get('/api/v1/webmcp/tools', { preHandler: [requireAuth] }, async (_req, reply) => {
    const bridge = getWebMCPBridge();
    return reply.send({ tools: bridge.getAllTools() });
  });

  app.get('/api/v1/webmcp/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const bridge = getWebMCPBridge();
    return reply.send(bridge.stats());
  });
};
