import type { AgentRole } from '../swarm/types.js';

export type NodeType = 'agent' | 'tool' | 'condition' | 'parallel' | 'loop' | 'input' | 'output';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
}

export interface AgentNodeConfig {
  role: AgentRole;
  prompt: string;
  systemPrompt?: string;
  maxSteps?: number;
  allowedTools?: string[];
}

export interface ToolNodeConfig {
  toolName: string;
  params: Record<string, unknown>;
}

export interface ConditionNodeConfig {
  expression: string;
  trueNext: string;
  falseNext: string;
}

export interface ParallelNodeConfig {
  branches: string[];
  joinStrategy: 'all' | 'first' | 'majority';
}

export interface LoopNodeConfig {
  body: string;
  maxIterations: number;
  condition: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryNode: string;
  createdAt: Date;
  updatedAt: Date;
}

type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export interface WorkflowRunState {
  workflowId: string;
  runId: string;
  status: WorkflowStatus;
  currentNodeId: string;
  nodeResults: Map<string, NodeResult>;
  variables: Map<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
}

export interface NodeResult {
  nodeId: string;
  status: 'completed' | 'failed' | 'skipped';
  output: unknown;
  error?: string;
  durationMs: number;
}
