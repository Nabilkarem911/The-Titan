import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import { incCounter, setGauge, observeHistogram } from '@titan/observability';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowRunState,
  NodeResult,
  AgentNodeConfig,
  ToolNodeConfig,
  ConditionNodeConfig,
  ParallelNodeConfig,
} from './types.js';
import type { LlmProvider, AgentRunInput, AgentRun, ToolCall, ToolResult } from '../types.js';

const log = getLogger().child({ component: 'dag-workflow-engine' });

export interface DAGExecutionResult {
  runId: string;
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  nodeResults: Map<string, NodeResult>;
  executionOrder: string[];
  parallelBatches: string[][];
  durationMs: number;
  retriedNodes: string[];
  skippedNodes: string[];
}

export interface DAGNodeRetryPolicy {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
}

export interface DAGExecutionOptions {
  retryPolicy?: DAGNodeRetryPolicy;
  failFast?: boolean;
  maxParallelism?: number;
  timeoutMs?: number;
}

export interface DAGWorkflowEngineDeps {
  llm: LlmProvider;
  executeTool: (call: ToolCall, runId: string) => Promise<ToolResult>;
  createAgentRun: (input: AgentRunInput) => Promise<AgentRun>;
}

export class DAGWorkflowEngine {
  private executions: Map<string, DAGExecutionResult> = new Map();
  private maxExecutions = 100;

  constructor(private deps: DAGWorkflowEngineDeps) {}

  async executeDAG(
    workflow: Workflow,
    options?: DAGExecutionOptions & { input?: Record<string, unknown> },
  ): Promise<DAGExecutionResult> {
    const runId = randomUUID();
    const startedAt = Date.now();
    const retryPolicy = options?.retryPolicy ?? { maxRetries: 2, retryDelayMs: 1000, backoffMultiplier: 2 };
    const failFast = options?.failFast ?? false;
    const maxParallelism = options?.maxParallelism ?? 5;

    log.info({ runId, workflowId: workflow.id, nodes: workflow.nodes.length }, 'DAG execution started');

    // Validate DAG — detect cycles
    const cycleError = this.detectCycles(workflow);
    if (cycleError) {
      incCounter('dag_cycle_detected', 'DAG cycle detections', 1, { workflowId: workflow.id });
      const result: DAGExecutionResult = {
        runId,
        workflowId: workflow.id,
        status: 'failed',
        nodeResults: new Map(),
        executionOrder: [],
        parallelBatches: [],
        durationMs: Date.now() - startedAt,
        retriedNodes: [],
        skippedNodes: workflow.nodes.map(n => n.id),
      };
      log.error({ runId, error: cycleError }, 'DAG execution failed — cycle detected');
      return result;
    }

    // Topological sort with parallel batches
    const batches = this.topologicalBatches(workflow);
    log.info({ runId, batches: batches.length, batchSizes: batches.map(b => b.length) }, 'DAG topological batches computed');

    const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));
    const edgeMap = new Map<string, WorkflowEdge[]>();
    for (const edge of workflow.edges) {
      const edges = edgeMap.get(edge.to) ?? [];
      edges.push(edge);
      edgeMap.set(edge.to, edges);
    }

    const nodeResults = new Map<string, NodeResult>();
    const variables = new Map<string, unknown>(options?.input ? Object.entries(options.input) : []);
    const executionOrder: string[] = [];
    const retriedNodes: string[] = [];
    const skippedNodes: string[] = [];
    let overallStatus: 'completed' | 'failed' | 'partial' = 'completed';

    for (const batch of batches) {
      const executableNodes = batch.filter(nodeId => {
        const incomingEdges = edgeMap.get(nodeId) ?? [];
        return incomingEdges.every(e => {
          if (e.label === 'false') return false; // condition false edges handled separately
          const result = nodeResults.get(e.from);
          return result && result.status === 'completed';
        });
      });

      const nodesToExecute = executableNodes.filter(id => !skippedNodes.includes(id));
      if (nodesToExecute.length === 0) {
        for (const id of batch) {
          if (!nodeResults.has(id)) skippedNodes.push(id);
        }
        continue;
      }

      // Execute batch in parallel (limited by maxParallelism)
      const results = await this.executeBatch(
        nodesToExecute.map(id => nodeMap.get(id)!).filter(Boolean),
        nodeResults,
        variables,
        runId,
        retryPolicy,
        maxParallelism,
      );

      for (const { nodeId, result, retried } of results) {
        nodeResults.set(nodeId, result);
        executionOrder.push(nodeId);
        if (retried) retriedNodes.push(nodeId);

        if (result.status === 'failed' && failFast) {
          overallStatus = 'failed';
          // Skip all remaining nodes
          for (const remainingBatch of batches.slice(batches.indexOf(batch) + 1)) {
            for (const id of remainingBatch) {
              if (!nodeResults.has(id)) skippedNodes.push(id);
            }
          }
          break;
        }

        if (result.status === 'failed' && overallStatus === 'completed') {
          overallStatus = 'partial';
        }
      }

      if (overallStatus === 'failed' && failFast) break;

      // Handle condition nodes — mark false-branch nodes as skipped
      for (const nodeId of nodesToExecute) {
        const node = nodeMap.get(nodeId);
        if (node?.type === 'condition') {
          const config = node.config as unknown as ConditionNodeConfig;
          const condResult = nodeResults.get(nodeId);
          const taken = condResult?.output === true;
          const skippedBranch = taken ? config.falseNext : config.trueNext;
          if (skippedBranch && !skippedNodes.includes(skippedBranch)) {
            skippedNodes.push(skippedBranch);
          }
        }
      }
    }

    const dagResult: DAGExecutionResult = {
      runId,
      workflowId: workflow.id,
      status: overallStatus,
      nodeResults,
      executionOrder,
      parallelBatches: batches,
      durationMs: Date.now() - startedAt,
      retriedNodes,
      skippedNodes,
    };

    this.executions.set(runId, dagResult);
    if (this.executions.size > this.maxExecutions) {
      const oldest = this.executions.keys().next().value;
      if (oldest) this.executions.delete(oldest);
    }

    setGauge('dag_executions', 'DAG executions stored', this.executions.size);
    incCounter('dag_execute', 'DAG executions', 1, { status: overallStatus });
    observeHistogram('dag_duration_ms', 'DAG execution duration', dagResult.durationMs);

    log.info({
      runId,
      status: overallStatus,
      nodesExecuted: executionOrder.length,
      nodesSkipped: skippedNodes.length,
      nodesRetried: retriedNodes.length,
      durationMs: dagResult.durationMs,
    }, 'DAG execution complete');

    return dagResult;
  }

  private async executeBatch(
    nodes: WorkflowNode[],
    priorResults: Map<string, NodeResult>,
    variables: Map<string, unknown>,
    runId: string,
    retryPolicy: DAGNodeRetryPolicy,
    maxParallelism: number,
  ): Promise<Array<{ nodeId: string; result: NodeResult; retried: boolean }>> {
    const results: Array<{ nodeId: string; result: NodeResult; retried: boolean }> = [];

    // Execute in chunks limited by maxParallelism
    for (let i = 0; i < nodes.length; i += maxParallelism) {
      const chunk = nodes.slice(i, i + maxParallelism);
      const chunkResults = await Promise.all(
        chunk.map(async node => {
          let result = await this.executeNode(node, priorResults, variables, runId);
          let retried = false;

          if (result.status === 'failed' && retryPolicy.maxRetries > 0) {
            for (let attempt = 1; attempt <= retryPolicy.maxRetries; attempt++) {
              const delay = retryPolicy.retryDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1);
              log.info({ nodeId: node.id, attempt, delayMs: delay }, 'DAG retrying node');
              await new Promise(resolve => setTimeout(resolve, delay));
              result = await this.executeNode(node, priorResults, variables, runId);
              retried = true;
              if (result.status === 'completed') {
                incCounter('dag_retry_success', 'DAG retry successes', 1, { nodeId: node.id });
                break;
              }
            }
          }

          return { nodeId: node.id, result, retried };
        }),
      );
      results.push(...chunkResults);
    }

    return results;
  }

  private async executeNode(
    node: WorkflowNode,
    priorResults: Map<string, NodeResult>,
    variables: Map<string, unknown>,
    runId: string,
  ): Promise<NodeResult> {
    const start = performance.now();
    incCounter('dag_node_execute', 'DAG node executions', 1, { type: node.type });

    try {
      let output: unknown;

      switch (node.type) {
        case 'input':
          output = Object.fromEntries(variables);
          break;

        case 'agent': {
          const config = node.config as unknown as AgentNodeConfig;
          const context = this.gatherContext(node.id, priorResults, variables);
          const fullPrompt = context
            ? `${config.prompt}\n\nContext from upstream nodes:\n${context}`
            : config.prompt;

          const agentRun = await this.deps.createAgentRun({
            agentId: `dag_${node.id}`,
            prompt: fullPrompt,
            maxSteps: config.maxSteps ?? 5,
            systemPromptExtra: config.systemPrompt,
          });

          output = agentRun.finalAnswer ?? agentRun.status;
          variables.set(`${node.id}_result`, output);
          break;
        }

        case 'tool': {
          const config = node.config as unknown as ToolNodeConfig;
          const resolvedParams: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(config.params)) {
            resolvedParams[key] = typeof val === 'string' && val.startsWith('$')
              ? variables.get(val.slice(1)) ?? val
              : val;
          }

          const result = await this.deps.executeTool(
            { name: config.toolName, params: resolvedParams },
            runId,
          );
          output = result.success ? result.data : result.error;
          variables.set(`${node.id}_result`, output);
          break;
        }

        case 'condition': {
          const config = node.config as unknown as ConditionNodeConfig;
          output = this.evaluateCondition(config.expression, variables);
          variables.set(`${node.id}_result`, output);
          break;
        }

        case 'parallel': {
          const config = node.config as unknown as ParallelNodeConfig;
          const branchResults = config.branches.map(branchId => {
            const branchResult = priorResults.get(branchId);
            return branchResult?.output;
          });
          output = branchResults.filter(Boolean);
          variables.set(`${node.id}_result`, output);
          break;
        }

        case 'output': {
          output = this.gatherContext(node.id, priorResults, variables);
          variables.set('output', output);
          break;
        }

        default:
          output = null;
      }

      const duration = Math.round(performance.now() - start);
      observeHistogram('dag_node_duration_ms', 'DAG node execution duration', duration);

      return {
        nodeId: node.id,
        status: 'completed',
        output,
        durationMs: duration,
      };
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      incCounter('dag_node_failed', 'DAG node failures', 1, { nodeId: node.id });
      return {
        nodeId: node.id,
        status: 'failed',
        output: null,
        error: err instanceof Error ? err.message : 'Unknown error',
        durationMs: duration,
      };
    }
  }

  private gatherContext(
    nodeId: string,
    priorResults: Map<string, NodeResult>,
    variables: Map<string, unknown>,
  ): string {
    const contexts: string[] = [];
    for (const [id, result] of priorResults) {
      if (id === nodeId) continue;
      if (result.status === 'completed' && result.output != null) {
        contexts.push(`[${id}]: ${String(result.output).slice(0, 500)}`);
      }
    }
    return contexts.join('\n');
  }

  private evaluateCondition(expression: string, variables: Map<string, unknown>): boolean {
    const varMatch = expression.match(/^\$(\w+)\s*(==|!=|>|<|contains)\s*(.+)$/);
    if (varMatch) {
      const [, varName, op, expected] = varMatch;
      const actual = variables.get(varName);
      switch (op) {
        case '==': return String(actual) === expected.trim();
        case '!=': return String(actual) !== expected.trim();
        case '>': return Number(actual) > Number(expected);
        case '<': return Number(actual) < Number(expected);
        case 'contains': return String(actual).includes(expected.trim());
      }
    }
    if (expression.startsWith('$')) {
      const val = variables.get(expression.slice(1));
      return !!val;
    }
    return expression === 'true';
  }

  // ===== Cycle Detection (DFS-based) =====

  private detectCycles(workflow: Workflow): string | null {
    const adjacency = new Map<string, string[]>();
    for (const node of workflow.nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of workflow.edges) {
      const targets = adjacency.get(edge.from) ?? [];
      targets.push(edge.to);
      adjacency.set(edge.from, targets);
    }

    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const node of workflow.nodes) {
      color.set(node.id, WHITE);
    }

    const dfs = (nodeId: string, path: string[]): string | null => {
      color.set(nodeId, GRAY);
      path.push(nodeId);
      const neighbors = adjacency.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (color.get(neighbor) === GRAY) {
          return `Cycle detected: ${[...path, neighbor].join(' → ')}`;
        }
        if (color.get(neighbor) === WHITE) {
          const result = dfs(neighbor, path);
          if (result) return result;
        }
      }
      path.pop();
      color.set(nodeId, BLACK);
      return null;
    };

    for (const node of workflow.nodes) {
      if (color.get(node.id) === WHITE) {
        const result = dfs(node.id, []);
        if (result) return result;
      }
    }

    return null;
  }

  // ===== Topological Sort with Parallel Batches (Kahn's Algorithm) =====

  private topologicalBatches(workflow: Workflow): string[][] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of workflow.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of workflow.edges) {
      if (!adjacency.has(edge.from) || !inDegree.has(edge.to)) continue;
      adjacency.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, inDegree.get(edge.to)! + 1);
    }

    const batches: string[][] = [];
    const processed = new Set<string>();

    while (processed.size < workflow.nodes.length) {
      const batch: string[] = [];
      for (const [nodeId, degree] of inDegree) {
        if (degree === 0 && !processed.has(nodeId)) {
          batch.push(nodeId);
        }
      }

      if (batch.length === 0) break; // Remaining nodes are in a cycle (shouldn't happen after detectCycles)

      for (const nodeId of batch) {
        processed.add(nodeId);
        for (const neighbor of adjacency.get(nodeId) ?? []) {
          inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        }
      }

      batches.push(batch);
    }

    return batches;
  }

  // ===== Public API =====

  getExecution(runId: string): DAGExecutionResult | null {
    return this.executions.get(runId) ?? null;
  }

  getExecutions(): DAGExecutionResult[] {
    return Array.from(this.executions.values());
  }

  stats(): {
    totalExecutions: number;
    completed: number;
    failed: number;
    partial: number;
  } {
    const all = Array.from(this.executions.values());
    return {
      totalExecutions: all.length,
      completed: all.filter(e => e.status === 'completed').length,
      failed: all.filter(e => e.status === 'failed').length,
      partial: all.filter(e => e.status === 'partial').length,
    };
  }

  clear(): void {
    this.executions.clear();
  }
}
