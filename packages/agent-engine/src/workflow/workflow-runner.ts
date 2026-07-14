import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { LlmProvider, AgentRunInput, AgentRun, ToolCall, ToolResult } from '../types.js';
import type {
  Workflow,
  WorkflowNode,
  WorkflowRunState,
  NodeResult,
  AgentNodeConfig,
  ToolNodeConfig,
  ConditionNodeConfig,
  ParallelNodeConfig,
  LoopNodeConfig,
} from './types.js';

const log = getLogger().child({ component: 'workflow-runner' });

interface WorkflowRunnerDeps {
  llm: LlmProvider;
  executeTool: (call: ToolCall, runId: string) => Promise<ToolResult>;
  createAgentRun: (input: AgentRunInput) => Promise<AgentRun>;
}

export class WorkflowRunner {
  constructor(private deps: WorkflowRunnerDeps) {}

  async run(workflow: Workflow, input?: Record<string, unknown>): Promise<WorkflowRunState> {
    const state: WorkflowRunState = {
      workflowId: workflow.id,
      runId: randomUUID(),
      status: 'running',
      currentNodeId: workflow.entryNode,
      nodeResults: new Map(),
      variables: new Map(input ? Object.entries(input) : []),
      startedAt: new Date(),
    };

    log.info({ workflowId: workflow.id, runId: state.runId, nodes: workflow.nodes.length }, 'workflow started');

    const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));
    const edgeMap = new Map<string, string[]>();
    for (const edge of workflow.edges) {
      const targets = edgeMap.get(edge.from) ?? [];
      targets.push(edge.to);
      edgeMap.set(edge.from, targets);
    }

    const visited = new Set<string>();
    let currentId: string | null = workflow.entryNode;
    let iterations = 0;
    const maxIterations = workflow.nodes.length * 3;

    try {
      while (currentId && iterations < maxIterations) {
        iterations++;
        const node = nodeMap.get(currentId);
        if (!node) {
          log.warn({ nodeId: currentId }, 'node not found');
          break;
        }

        if (node.type === 'output') {
          const lastResult = this.getLastOutput(state);
          state.variables.set('output', lastResult);
          state.nodeResults.set(node.id, { nodeId: node.id, status: 'completed', output: lastResult, durationMs: 0 });
          break;
        }

        if (visited.has(currentId) && node.type !== 'loop') {
          log.warn({ nodeId: currentId }, 'cycle detected — stopping');
          break;
        }
        visited.add(currentId);

        state.currentNodeId = currentId;
        const result = await this.executeNode(node, state);
        state.nodeResults.set(node.id, result);

        if (result.status === 'failed') {
          state.status = 'failed';
          break;
        }

        // Determine next node
        if (node.type === 'condition') {
          const config = node.config as unknown as ConditionNodeConfig;
          const condResult = this.evaluateCondition(config.expression, state);
          currentId = condResult ? config.trueNext : config.falseNext;
        } else if (node.type === 'loop') {
          const config = node.config as unknown as LoopNodeConfig;
          const continueLoop = this.evaluateCondition(config.condition, state);
          if (continueLoop) {
            visited.delete(currentId); // allow re-visit
            currentId = config.body;
          } else {
            currentId = this.getNextNode(currentId, edgeMap);
          }
        } else {
          currentId = this.getNextNode(currentId, edgeMap);
        }
      }

      if (state.status === 'running') {
        state.status = 'completed';
      }
    } catch (err) {
      state.status = 'failed';
      log.error({ runId: state.runId, err: err instanceof Error ? err.message : 'Unknown' }, 'workflow failed');
    }

    state.completedAt = new Date();
    log.info({
      runId: state.runId,
      status: state.status,
      nodesExecuted: state.nodeResults.size,
      durationMs: state.completedAt.getTime() - state.startedAt.getTime(),
    }, 'workflow completed');

    return state;
  }

  private async executeNode(node: WorkflowNode, state: WorkflowRunState): Promise<NodeResult> {
    const start = performance.now();

    try {
      let output: unknown;

      switch (node.type) {
        case 'input':
          output = Object.fromEntries(state.variables);
          break;

        case 'agent': {
          const config = node.config as unknown as AgentNodeConfig;
          const contextFromPrevious = this.getLastOutput(state);
          const fullPrompt = contextFromPrevious
            ? `${config.prompt}\n\nContext from previous step:\n${String(contextFromPrevious).slice(0, 3000)}`
            : config.prompt;

          const agentRun = await this.deps.createAgentRun({
            agentId: `workflow_${node.id}`,
            prompt: fullPrompt,
            maxSteps: config.maxSteps ?? 5,
            systemPromptExtra: config.systemPrompt,
          });

          output = agentRun.finalAnswer ?? agentRun.status;
          state.variables.set(`${node.id}_result`, output);
          break;
        }

        case 'tool': {
          const config = node.config as unknown as ToolNodeConfig;
          const resolvedParams: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(config.params)) {
            resolvedParams[key] = typeof val === 'string' && val.startsWith('$')
              ? state.variables.get(val.slice(1)) ?? val
              : val;
          }

          const result = await this.deps.executeTool(
            { name: config.toolName, params: resolvedParams },
            state.runId,
          );
          output = result.success ? result.data : result.error;
          state.variables.set(`${node.id}_result`, output);
          break;
        }

        case 'parallel': {
          const config = node.config as unknown as ParallelNodeConfig;
          const branchResults = await Promise.all(
            config.branches.map(async (branchId) => {
              const branchNode = state.nodeResults.get(branchId);
              return branchNode?.output;
            }),
          );
          output = branchResults.filter(Boolean);
          break;
        }

        default:
          output = null;
      }

      return {
        nodeId: node.id,
        status: 'completed',
        output,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      return {
        nodeId: node.id,
        status: 'failed',
        output: null,
        error: err instanceof Error ? err.message : 'Unknown error',
        durationMs: Math.round(performance.now() - start),
      };
    }
  }

  private evaluateCondition(expression: string, state: WorkflowRunState): boolean {
    // Simple evaluation: check variable truthiness or string comparisons
    const varMatch = expression.match(/^\$(\w+)\s*(==|!=|>|<|contains)\s*(.+)$/);
    if (varMatch) {
      const [, varName, op, expected] = varMatch;
      const actual = state.variables.get(varName);

      switch (op) {
        case '==': return String(actual) === expected.trim();
        case '!=': return String(actual) !== expected.trim();
        case '>': return Number(actual) > Number(expected);
        case '<': return Number(actual) < Number(expected);
        case 'contains': return String(actual).includes(expected.trim());
      }
    }

    // Just check if variable is truthy
    if (expression.startsWith('$')) {
      const val = state.variables.get(expression.slice(1));
      return !!val;
    }

    return expression === 'true';
  }

  private getNextNode(currentId: string, edgeMap: Map<string, string[]>): string | null {
    const targets = edgeMap.get(currentId);
    return targets && targets.length > 0 ? targets[0] : null;
  }

  private getLastOutput(state: WorkflowRunState): unknown {
    const results = Array.from(state.nodeResults.values());
    if (results.length === 0) return undefined;
    const last = results[results.length - 1];
    return last.output;
  }
}
