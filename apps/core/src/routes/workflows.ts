import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../plugins/auth.js';

// In-memory workflow store (persists for server lifetime)
interface StoredWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: Array<{ id: string; type: string; label: string; config: Record<string, unknown> }>;
  edges: Array<{ from: string; to: string; label?: string }>;
  entryNode: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowExecution {
  runId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  results?: Array<{ nodeId: string; status: string; output: unknown; error?: string }>;
}

const workflows = new Map<string, StoredWorkflow>();
const executions = new Map<string, WorkflowExecution>();

export const workflowRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/workflows — list all workflows
  app.get('/api/v1/workflows', { preHandler: [requireAuth] }, async (_req, reply) => {
    const items = Array.from(workflows.values()).map(w => ({
      ...w,
      nodes: w.nodes.length,
      edges: w.edges.length,
    }));
    return reply.send({ items, total: items.length });
  });

  // GET /api/v1/workflows/:id — get a specific workflow
  app.get('/api/v1/workflows/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const wf = workflows.get(id);
    if (!wf) return reply.status(404).send({ error: 'Workflow not found' });
    return reply.send(wf);
  });

  // POST /api/v1/workflows — create a new workflow
  app.post('/api/v1/workflows', { preHandler: [requireAuth] }, async (req, reply) => {
    const { name, description, nodes, edges, entryNode } = req.body as {
      name: string;
      description?: string;
      nodes: StoredWorkflow['nodes'];
      edges: StoredWorkflow['edges'];
      entryNode: string;
    };

    if (!name || !nodes || !entryNode) {
      return reply.status(400).send({ error: 'name, nodes, and entryNode are required' });
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const wf: StoredWorkflow = { id, name, description: description || '', nodes, edges, entryNode, createdAt: now, updatedAt: now };
    workflows.set(id, wf);
    return reply.send(wf);
  });

  // PUT /api/v1/workflows/:id — update a workflow
  app.put('/api/v1/workflows/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const wf = workflows.get(id);
    if (!wf) return reply.status(404).send({ error: 'Workflow not found' });

    const { name, description, nodes, edges, entryNode } = req.body as Partial<StoredWorkflow>;
    if (name) wf.name = name;
    if (description !== undefined) wf.description = description;
    if (nodes) wf.nodes = nodes;
    if (edges) wf.edges = edges;
    if (entryNode) wf.entryNode = entryNode;
    wf.updatedAt = new Date().toISOString();

    return reply.send(wf);
  });

  // DELETE /api/v1/workflows/:id — delete a workflow
  app.delete('/api/v1/workflows/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const removed = workflows.delete(id);
    if (!removed) return reply.status(404).send({ error: 'Workflow not found' });
    return reply.send({ deleted: true, id });
  });

  // POST /api/v1/workflows/:id/execute — execute a workflow
  app.post('/api/v1/workflows/:id/execute', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const wf = workflows.get(id);
    if (!wf) return reply.status(404).send({ error: 'Workflow not found' });

    const { input } = (req.body as { input?: Record<string, unknown> }) || {};
    const runId = randomUUID();
    const exec: WorkflowExecution = {
      runId,
      workflowId: id,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    executions.set(runId, exec);

    // Simulate execution (real execution would use WorkflowRunner)
    // For now, mark as completed with node results
    exec.status = 'completed';
    exec.completedAt = new Date().toISOString();
    exec.results = wf.nodes.map(n => ({
      nodeId: n.id,
      status: 'completed',
      output: { label: n.label, type: n.type },
    }));

    return reply.send(exec);
  });

  // GET /api/v1/workflows/:id/executions — list executions for a workflow
  app.get('/api/v1/workflows/:id/executions', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const items = Array.from(executions.values()).filter(e => e.workflowId === id);
    return reply.send({ items, total: items.length });
  });
};
