import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { LlmProvider, AgentRunInput, AgentRun, ToolCall, ToolResult, LlmToolDefinition } from '../types.js';
import { AgentPool } from './agent-pool.js';
import { DynamicAgentFactory } from './dynamic-factory.js';
import type { SpawnRequest, AggregatedResult, DynamicAgentSpec } from './types.js';

const log = getLogger().child({ component: 'orchestration-engine' });

const ORCHESTRATOR_PROMPT = `You are a task orchestrator. Given a complex task, decide how to split it into sub-tasks for parallel execution by specialized agents.

Available capabilities: search, code, data, web, files, communication, security, devops

Respond ONLY with JSON:
{
  "subtasks": [
    {
      "name": "descriptive name",
      "role": "agent role",
      "goal": "specific goal for this agent",
      "capabilities": ["search", "code"],
      "dependsOn": [],
      "mode": "foreground"
    }
  ],
  "synthesis_strategy": "merge|vote|best|sequential"
}`;

export interface OrchestrationDeps {
  llm: LlmProvider;
  executeTool: (call: ToolCall, runId: string) => Promise<ToolResult>;
  createAgentRun: (input: AgentRunInput) => Promise<AgentRun>;
  availableTools: LlmToolDefinition[];
}

export interface OrchestrationResult {
  id: string;
  task: string;
  subtaskCount: number;
  result: AggregatedResult;
  synthesis: string;
  durationMs: number;
}

export class OrchestrationEngine {
  private pool: AgentPool;
  private factory: DynamicAgentFactory;
  private llm: LlmProvider;

  constructor(deps: OrchestrationDeps) {
    this.llm = deps.llm;
    this.pool = new AgentPool(deps);
    this.factory = new DynamicAgentFactory(deps.llm, deps.availableTools);
  }

  async orchestrate(task: string, context?: string): Promise<OrchestrationResult> {
    const id = randomUUID();
    const start = performance.now();

    log.info({ id, task: task.slice(0, 100) }, 'orchestration started');

    // Step 1: Decompose task into subtasks
    const plan = await this.planSubtasks(task, context);

    // Step 2: Create agents dynamically
    const spawnRequests: SpawnRequest[] = [];
    for (const subtask of plan.subtasks) {
      const spec: DynamicAgentSpec = {
        role: subtask.role,
        goal: subtask.goal,
        requiredCapabilities: subtask.capabilities,
        context,
      };
      const request = await this.factory.createAgent(spec, id);
      request.mode = subtask.mode as 'foreground' | 'background';
      request.name = subtask.name;
      spawnRequests.push(request);
    }

    // Step 3: Execute via pool (respects concurrency limits)
    // Run independent tasks in parallel, dependent tasks sequentially
    const independent = spawnRequests.filter((_, i) => !plan.subtasks[i].dependsOn?.length);
    const dependent = spawnRequests.filter((_, i) => plan.subtasks[i].dependsOn?.length > 0);

    // Run independent tasks
    if (independent.length > 0) {
      await this.pool.submitBatch(independent);
    }

    // Run dependent tasks
    for (const req of dependent) {
      await this.pool.submit(req);
    }

    // Step 4: Wait and aggregate
    const spawner = this.pool.getSpawner();
    await spawner.waitForAll(id);
    const aggregated = await spawner.aggregate(id);

    // Step 5: Final synthesis
    const synthesis = aggregated.synthesis ?? aggregated.children.map((c) => c.result).filter(Boolean).join('\n\n');

    const durationMs = Math.round(performance.now() - start);
    log.info({ id, subtasks: plan.subtasks.length, durationMs, success: aggregated.allSucceeded }, 'orchestration completed');

    return {
      id,
      task,
      subtaskCount: plan.subtasks.length,
      result: aggregated,
      synthesis,
      durationMs,
    };
  }

  getPoolStats() {
    return this.pool.getStats();
  }

  private async planSubtasks(task: string, context?: string): Promise<{
    subtasks: Array<{ name: string; role: string; goal: string; capabilities: string[]; dependsOn: string[]; mode: string }>;
    synthesisStrategy: string;
  }> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: ORCHESTRATOR_PROMPT },
        { role: 'user', content: `Task: ${task}${context ? `\n\nContext: ${context}` : ''}` },
      ], { temperature: 0.3 });

      const match = completion.content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>;
        const subtasks = Array.isArray(parsed.subtasks)
          ? parsed.subtasks.map((s) => {
              const raw = s as Record<string, unknown>;
              return {
                name: String(raw.name ?? ''),
                role: String(raw.role ?? 'executor'),
                goal: String(raw.goal ?? ''),
                capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.map(String) : ['search'],
                dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(String) : [],
                mode: String(raw.mode ?? 'foreground'),
              };
            })
          : [];

        return { subtasks, synthesisStrategy: String(parsed.synthesis_strategy ?? 'merge') };
      }
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'planning failed — single agent fallback');
    }

    // Fallback: single agent
    return {
      subtasks: [{ name: 'main', role: 'executor', goal: task, capabilities: ['search', 'code'], dependsOn: [], mode: 'foreground' }],
      synthesisStrategy: 'best',
    };
  }
}
