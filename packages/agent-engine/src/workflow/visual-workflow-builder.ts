import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { visualWorkflows as vwRepo } from '@titan/database';

const log = getLogger().child({ component: 'visual-workflow' });

export type VisualNodeType = 'trigger' | 'agent' | 'tool' | 'condition' | 'parallel' | 'delay';
export type TriggerType = 'webhook' | 'cron' | 'file_change' | 'agent_completion';

export interface VisualWorkflowNode {
  id: string;
  type: VisualNodeType;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface VisualWorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition?: string;
}

export interface VisualWorkflow {
  id: string;
  name: string;
  nodes: VisualWorkflowNode[];
  edges: VisualWorkflowEdge[];
  trigger?: { type: TriggerType; config: Record<string, unknown> };
  createdAt: Date;
  exported: boolean;
}

export class VisualWorkflowBuilder {
  private workflows: VisualWorkflow[] = [];

  createWorkflow(name: string): VisualWorkflow {
    const workflow: VisualWorkflow = {
      id: randomUUID(),
      name,
      nodes: [],
      edges: [],
      createdAt: new Date(),
      exported: false,
    };
    this.workflows.push(workflow);
    vwRepo.insert(workflow.id, { name: workflow.name, description: '', nodes: JSON.stringify(workflow.nodes), edges: JSON.stringify(workflow.edges), status: 'draft' }).catch((err) => log.error({ err }, 'DB write failed'));
    incCounter('workflows_created', 'Visual workflows created', 1);
    return workflow;
  }

  addNode(workflowId: string, type: VisualNodeType, label: string, config?: Record<string, unknown>, position?: { x: number; y: number }): VisualWorkflowNode {
    const workflow = this.workflows.find((w) => w.id === workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const node: VisualWorkflowNode = {
      id: randomUUID(),
      type,
      label,
      config: config ?? {},
      position: position ?? { x: workflow.nodes.length * 200, y: 100 },
    };

    workflow.nodes.push(node);
    return node;
  }

  addEdge(workflowId: string, from: string, to: string, condition?: string): VisualWorkflowEdge {
    const workflow = this.workflows.find((w) => w.id === workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const edge: VisualWorkflowEdge = {
      id: randomUUID(),
      from,
      to,
      condition,
    };

    workflow.edges.push(edge);
    return edge;
  }

  setTrigger(workflowId: string, type: TriggerType, config: Record<string, unknown>): void {
    const workflow = this.workflows.find((w) => w.id === workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    workflow.trigger = { type, config };
  }

  addConditionNode(workflowId: string, label: string, ifCondition: string, elseCondition?: string): { ifNode: VisualWorkflowNode; elseNode?: VisualWorkflowNode } {
    const ifNode = this.addNode(workflowId, 'condition', label, { if: ifCondition, else: elseCondition });
    let elseNode: VisualWorkflowNode | undefined;
    if (elseCondition) {
      elseNode = this.addNode(workflowId, 'condition', `${label} (else)`, { condition: elseCondition });
    }
    return { ifNode, elseNode };
  }

  exportToDAG(workflowId: string): { nodes: Array<{ id: string; type: string; config: Record<string, unknown> }>; edges: Array<{ from: string; to: string; condition?: string }> } {
    const workflow = this.workflows.find((w) => w.id === workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const dag = {
      nodes: workflow.nodes.map((n) => ({ id: n.id, type: n.type, config: n.config })),
      edges: workflow.edges.map((e) => ({ from: e.from, to: e.to, condition: e.condition })),
    };

    workflow.exported = true;
    incCounter('workflows_exported', 'Workflows exported to DAG', 1);
    log.info({ workflowId, nodes: dag.nodes.length, edges: dag.edges.length }, 'workflow exported to DAG format');
    return dag;
  }

  async getWorkflows(): Promise<VisualWorkflow[]> {
    try {
      const rows = await vwRepo.listAll(500);
      return rows.map((row) => this.rowToWorkflow(row));
    } catch (err) {
      log.warn({ err }, 'failed to load workflows from DB — returning in-memory only');
      return [...this.workflows];
    }
  }

  async getWorkflow(id: string): Promise<VisualWorkflow | null> {
    const cached = this.workflows.find((w) => w.id === id);
    if (cached) return cached;
    try {
      const row = await vwRepo.findById(id);
      if (!row) return null;
      return this.rowToWorkflow(row);
    } catch (err) {
      log.warn({ err, id }, 'failed to load workflow from DB');
      return null;
    }
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const idx = this.workflows.findIndex((w) => w.id === id);
    if (idx >= 0) {
      this.workflows.splice(idx, 1);
    }
    try {
      await vwRepo.deleteById(id);
      return true;
    } catch (err) {
      log.warn({ err, id }, 'failed to delete workflow from DB');
      return idx >= 0;
    }
  }

  private rowToWorkflow(row: Record<string, unknown>): VisualWorkflow {
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : [],
      edges: typeof row.edges === 'string' ? JSON.parse(row.edges) : [],
      trigger: undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : new Date(),
      exported: String(row.status ?? '') === 'exported',
    };
  }

  getStats(): { total: number; exported: number; totalNodes: number; totalEdges: number } {
    return {
      total: this.workflows.length,
      exported: this.workflows.filter((w) => w.exported).length,
      totalNodes: this.workflows.reduce((s, w) => s + w.nodes.length, 0),
      totalEdges: this.workflows.reduce((s, w) => s + w.edges.length, 0),
    };
  }

  reset(): void {
    this.workflows = [];
  }
}
