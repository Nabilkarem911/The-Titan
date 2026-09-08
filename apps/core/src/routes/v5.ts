import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { getLogger } from '@titan/logging';
import {
  MCPGovernanceManager,
  DAGWorkflowEngine,
  MultiLayerGuardrails,
  createProviderFromEnv,
  getGlobalToolRegistry,
} from '@titan/agent-engine';
import { BiTemporalKnowledgeGraph } from '@titan/memory';

const log = getLogger().child({ component: 'v5-routes' });

// ===== Singletons =====

let mcpGovernance: MCPGovernanceManager | null = null;
let dagEngine: DAGWorkflowEngine | null = null;
let multiLayerGuardrails: MultiLayerGuardrails | null = null;
let biTempGraph: BiTemporalKnowledgeGraph | null = null;

function getMCPGovernance(): MCPGovernanceManager {
  if (mcpGovernance) return mcpGovernance;
  mcpGovernance = new MCPGovernanceManager();
  return mcpGovernance;
}

function getDAGEngine(): DAGWorkflowEngine | null {
  if (dagEngine) return dagEngine;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  const toolRegistry = getGlobalToolRegistry();
  dagEngine = new DAGWorkflowEngine({
    llm,
    executeTool: async (call, _runId) => {
      return toolRegistry.execute(call.name, call.params);
    },
    createAgentRun: async (input) => ({
      id: `dag-${Date.now()}`,
      agentId: input.agentId,
      prompt: input.prompt,
      status: 'completed',
      maxSteps: input.maxSteps ?? 5,
      currentStep: 1,
      tokensUsed: 0,
      steps: [],
      finalAnswer: `Processed: ${input.prompt.slice(0, 100)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });
  return dagEngine;
}

function getMultiLayerGuardrails(): MultiLayerGuardrails {
  if (multiLayerGuardrails) return multiLayerGuardrails;
  multiLayerGuardrails = new MultiLayerGuardrails();
  return multiLayerGuardrails;
}

function getBiTempGraph(): BiTemporalKnowledgeGraph {
  if (biTempGraph) return biTempGraph;
  biTempGraph = new BiTemporalKnowledgeGraph();
  return biTempGraph;
}

// ===== Schemas =====

const policySchema = z.object({
  serverId: z.string().min(1),
  allowedPermissions: z.array(z.enum(['read', 'write', 'execute', 'admin', 'delegate'])).default(['read']),
  allowedTools: z.union([z.array(z.string()), z.literal('*')]).default('*'),
  deniedTools: z.array(z.string()).default([]),
  rateLimitPerMinute: z.number().int().positive().default(60),
  requiresApproval: z.boolean().default(false),
  maxConcurrentInvocations: z.number().int().positive().default(5),
  auditEnabled: z.boolean().default(true),
});

const dagExecuteSchema = z.object({
  workflow: z.object({
    id: z.string(),
    name: z.string(),
    nodes: z.array(z.object({
      id: z.string(),
      type: z.enum(['agent', 'tool', 'condition', 'parallel', 'loop', 'input', 'output']),
      label: z.string(),
      config: z.record(z.unknown()).default({}),
    })),
    edges: z.array(z.object({
      from: z.string(),
      to: z.string(),
      label: z.string().optional(),
    })),
    entryNode: z.string(),
  }),
  input: z.record(z.unknown()).optional(),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(10),
    retryDelayMs: z.number().int().min(0),
    backoffMultiplier: z.number().min(1).max(10),
  }).optional(),
  failFast: z.boolean().optional(),
  maxParallelism: z.number().int().min(1).max(20).optional(),
});

const guardrailInputSchema = z.object({
  input: z.string().min(1).max(100_000),
});

const guardrailOutputSchema = z.object({
  input: z.string().min(1).max(100_000),
  output: z.string().min(1).max(100_000),
});

const factSchema = z.object({
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  value: z.unknown().optional(),
  validTimeStart: z.string().datetime().optional(),
  source: z.string().min(1),
  salience: z.number().min(0).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const querySchema = z.object({
  subject: z.string().optional(),
  predicate: z.string().optional(),
  object: z.string().optional(),
  asOf: z.string().datetime().optional(),
  includeSuperseded: z.boolean().optional(),
  startNode: z.string().optional(),
  maxHops: z.number().int().min(1).max(10).optional(),
  minSalience: z.number().min(0).max(100).optional(),
});

// ===== Route Plugin =====

export const v5Routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ═══════════════════════════════════════════════════
  // MCP Governance
  // ═══════════════════════════════════════════════════

  app.post('/api/v1/mcp-governance/policies', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    try {
      const body = policySchema.parse(req.body);
      const mgr = getMCPGovernance();
      mgr.setPolicy(body);
      return reply.status(201).send({ serverId: body.serverId, set: true });
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: err.errors });
      return reply.status(500).send({ error: 'Failed to set policy' });
    }
  });

  app.get('/api/v1/mcp-governance/policies/:serverId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { serverId } = req.params as { serverId: string };
    const mgr = getMCPGovernance();
    const policy = mgr.getPolicy(serverId);
    if (!policy) return reply.status(404).send({ error: 'Policy not found' });
    return reply.send(policy);
  });

  app.delete('/api/v1/mcp-governance/policies/:serverId', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { serverId } = req.params as { serverId: string };
    const mgr = getMCPGovernance();
    const removed = mgr.removePolicy(serverId);
    if (!removed) return reply.status(404).send({ error: 'Policy not found' });
    return reply.status(204).send();
  });

  app.get('/api/v1/mcp-governance/policies', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mgr = getMCPGovernance();
    return reply.send({ policies: mgr.listPolicies() });
  });

  app.post('/api/v1/mcp-governance/check', { preHandler: [requireAuth] }, async (req, reply) => {
    const { serverId, tool, permission, userId } = req.body as { serverId: string; tool: string; permission: string; userId?: string };
    const mgr = getMCPGovernance();
    const result = mgr.checkPermission(serverId, tool, permission as Parameters<typeof mgr.checkPermission>[2], userId);
    return reply.send(result);
  });

  app.get('/api/v1/mcp-governance/audit', { preHandler: [requireAuth] }, async (req, reply) => {
    const { serverId, allowed, limit } = req.query as { serverId?: string; allowed?: string; limit?: string };
    const mgr = getMCPGovernance();
    const auditLog = mgr.getAuditLog({
      serverId,
      allowed: allowed !== undefined ? allowed === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return reply.send({ entries: auditLog });
  });

  app.get('/api/v1/mcp-governance/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mgr = getMCPGovernance();
    return reply.send(mgr.stats());
  });

  // ═══════════════════════════════════════════════════
  // DAG Workflow Engine
  // ═══════════════════════════════════════════════════

  app.post('/api/v1/workflows/dag/execute', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    try {
      const body = dagExecuteSchema.parse(req.body);
      const engine = getDAGEngine();
      if (!engine) return reply.status(503).send({ error: 'No LLM provider available' });

      const workflow = {
        id: body.workflow.id,
        name: body.workflow.name,
        description: body.workflow.name,
        nodes: body.workflow.nodes,
        edges: body.workflow.edges,
        entryNode: body.workflow.entryNode,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await engine.executeDAG(workflow, {
        input: body.input,
        retryPolicy: body.retryPolicy,
        failFast: body.failFast,
        maxParallelism: body.maxParallelism,
      });

      return reply.send({
        runId: result.runId,
        status: result.status,
        executionOrder: result.executionOrder,
        parallelBatches: result.parallelBatches,
        retriedNodes: result.retriedNodes,
        skippedNodes: result.skippedNodes,
        durationMs: result.durationMs,
        nodeResults: Array.from(result.nodeResults.entries()).map(([id, r]) => ({
          nodeId: id,
          status: r.status,
          output: r.output,
          error: r.error,
          durationMs: r.durationMs,
        })),
      });
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: err.errors });
      log.error({ err }, 'DAG execute failed');
      return reply.status(500).send({ error: 'DAG execution failed' });
    }
  });

  app.get('/api/v1/workflows/dag/executions', { preHandler: [requireAuth] }, async (_req, reply) => {
    const engine = getDAGEngine();
    if (!engine) return reply.status(503).send({ error: 'No LLM provider available' });
    return reply.send({ executions: await engine.getExecutions() });
  });

  app.get('/api/v1/workflows/dag/executions/:runId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    const engine = getDAGEngine();
    if (!engine) return reply.status(503).send({ error: 'No LLM provider available' });
    const result = await engine.getExecution(runId);
    if (!result) return reply.status(404).send({ error: 'Execution not found' });
    return reply.send(result);
  });

  app.get('/api/v1/workflows/dag/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const engine = getDAGEngine();
    if (!engine) return reply.status(503).send({ error: 'No LLM provider available' });
    return reply.send(engine.stats());
  });

  // ═══════════════════════════════════════════════════
  // Multi-Layer Guardrails
  // ═══════════════════════════════════════════════════

  app.post('/api/v1/guardrails/check-input', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      const { input } = guardrailInputSchema.parse(req.body);
      const guardrails = getMultiLayerGuardrails();
      const result = await guardrails.checkInput(input);
      return reply.send({
        id: result.id,
        finalAction: result.finalAction,
        finalReason: result.finalReason,
        sanitizedInput: result.sanitizedInput,
        layerResults: result.layerResults,
        durationMs: result.durationMs,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: err.errors });
      return reply.status(500).send({ error: 'Guardrail check failed' });
    }
  });

  app.post('/api/v1/guardrails/check-output', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      const body = guardrailOutputSchema.parse(req.body);
      const guardrails = getMultiLayerGuardrails();
      const result = await guardrails.checkOutput(body.input, body.output);
      return reply.send({
        id: result.id,
        finalAction: result.finalAction,
        finalReason: result.finalReason,
        sanitizedOutput: result.sanitizedOutput,
        layerResults: result.layerResults,
        durationMs: result.durationMs,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: err.errors });
      return reply.status(500).send({ error: 'Guardrail check failed' });
    }
  });

  app.get('/api/v1/guardrails/results', { preHandler: [requireAuth] }, async (req, reply) => {
    const { action } = req.query as { action?: string };
    const guardrails = getMultiLayerGuardrails();
    const results = guardrails.getResults(
      action ? { action: action as 'allow' | 'block' | 'warn' | 'sanitize' } : undefined,
    );
    return reply.send({ items: results, total: results.length });
  });

  app.get('/api/v1/guardrails/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const guardrails = getMultiLayerGuardrails();
    return reply.send(guardrails.stats());
  });

  app.patch('/api/v1/guardrails/layers/:layer', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { layer } = req.params as { layer: string };
    const { enabled, blockOnMatch, severity } = req.body as {
      enabled?: boolean; blockOnMatch?: boolean; severity?: string;
    };
    const guardrails = getMultiLayerGuardrails();
    const layerType = layer as Parameters<typeof guardrails.setLayerConfig>[0];
    const layerConfig: Parameters<typeof guardrails.setLayerConfig>[1] = {
      type: layerType,
      enabled: enabled ?? true,
      blockOnMatch: blockOnMatch ?? false,
      severity: (severity as Parameters<typeof guardrails.setLayerConfig>[1]['severity']) ?? 'medium',
    };
    guardrails.setLayerConfig(layerType, layerConfig);
    return reply.send({ layer, updated: true });
  });

  // ═══════════════════════════════════════════════════
  // Bi-Temporal Knowledge Graph
  // ═══════════════════════════════════════════════════

  app.post('/api/v1/graph/facts', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      const body = factSchema.parse(req.body);
      const graph = getBiTempGraph();
      const fact = graph.addFact({
        subject: body.subject,
        predicate: body.predicate,
        object: body.object,
        value: body.value,
        validTimeStart: body.validTimeStart ? new Date(body.validTimeStart) : undefined,
        source: body.source,
        salience: body.salience,
        metadata: body.metadata,
      });
      return reply.status(201).send(fact);
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: err.errors });
      return reply.status(500).send({ error: 'Failed to add fact' });
    }
  });

  app.get('/api/v1/graph/facts', { preHandler: [requireAuth] }, async (req, reply) => {
    const { subject, predicate, object, asOf, includeSuperseded } = req.query as {
      subject?: string; predicate?: string; object?: string; asOf?: string; includeSuperseded?: string;
    };
    const graph = getBiTempGraph();
    const facts = graph.queryFacts({
      subject,
      predicate,
      object,
      asOf: asOf ? new Date(asOf) : undefined,
      includeSuperseded: includeSuperseded === 'true',
    });
    return reply.send({ items: facts, total: facts.length });
  });

  app.post('/api/v1/graph/query', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      const body = querySchema.parse(req.body);
      const graph = getBiTempGraph();
      const results = graph.hybridRetrieval({
        subject: body.subject,
        predicate: body.predicate,
        object: body.object,
        asOf: body.asOf ? new Date(body.asOf) : undefined,
        startNode: body.startNode,
        maxHops: body.maxHops,
        minSalience: body.minSalience,
      });
      return reply.send(results);
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: err.errors });
      return reply.status(500).send({ error: 'Query failed' });
    }
  });

  app.post('/api/v1/graph/facts/:id/reinforce', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const graph = getBiTempGraph();
    graph.reinforceFact(id);
    return reply.send({ reinforced: true });
  });

  app.get('/api/v1/graph/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const graph = getBiTempGraph();
    return reply.send(graph.stats());
  });

  app.get('/api/v1/graph/conflicts', { preHandler: [requireAuth] }, async (_req, reply) => {
    const graph = getBiTempGraph();
    return reply.send({ items: graph.getConflicts() });
  });
};
