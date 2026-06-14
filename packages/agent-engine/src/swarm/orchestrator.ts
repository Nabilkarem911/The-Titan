import { getLogger } from '@titan/logging';
import { randomUUID } from 'node:crypto';
import type {
  SwarmTask,
  SwarmTaskInput,
  SwarmSubTask,
  SwarmAgent,
  SwarmResult,
  SwarmOrchestratorDeps,
  AgentRole,
} from './types.js';

const log = getLogger().child({ component: 'swarm-orchestrator' });

const DEFAULT_PLANNER_PROMPT = `You are a task planner. Break down the given task into sub-tasks for a team of AI agents.
Each sub-task should have:
- A specific agent role (planner, researcher, coder, reviewer, executor, synthesizer)
- A clear prompt describing what that agent should do
- Any context needed from previous sub-tasks

Respond ONLY with a JSON array in this format:
[
  { "role": "researcher", "prompt": "Research X", "dependsOn": [] },
  { "role": "coder", "prompt": "Write code for Y", "dependsOn": [0] }
]

Use "dependsOn" to indicate which sub-task indices must complete before this one.`;

export class SwarmOrchestrator {
  constructor(private deps: SwarmOrchestratorDeps) {}

  async createTask(input: SwarmTaskInput): Promise<SwarmTask> {
    const task: SwarmTask = {
      id: randomUUID(),
      description: input.description,
      originalPrompt: input.prompt,
      status: 'pending',
      subTasks: [],
      agents: input.agents,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    log.info({ taskId: task.id, agents: input.agents.length }, 'swarm task created');
    return task;
  }

  async plan(task: SwarmTask, llmPlanner: { complete: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string }> }): Promise<SwarmTask> {
    task.status = 'planning';
    log.info({ taskId: task.id }, 'planning swarm task');

    try {
      const messages = [
        { role: 'system', content: DEFAULT_PLANNER_PROMPT },
        { role: 'user', content: `Task: ${task.description}\n\nFull context: ${task.originalPrompt}\n\nAvailable agents:\n${task.agents.map((a) => `- ${a.role}: ${a.description}`).join('\n')}` },
      ];

      const completion = await llmPlanner.complete(messages);
      const plan = this.parsePlan(completion.content);

      task.subTasks = plan.map((p, i) => ({
        id: randomUUID(),
        agentRole: p.role,
        prompt: p.prompt,
        context: undefined,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(p.dependsOn !== undefined ? { parentId: String(p.dependsOn) } : {}),
      }));

      log.info({ taskId: task.id, subTasks: task.subTasks.length }, 'plan generated');
    } catch (err) {
      log.error({ taskId: task.id, err: err instanceof Error ? err.message : 'Unknown' }, 'planning failed');
      task.status = 'failed';
    }

    task.updatedAt = new Date();
    return task;
  }

  async execute(task: SwarmTask): Promise<SwarmTask> {
    task.status = 'executing';
    log.info({ taskId: task.id }, 'executing swarm task');

    // Execute sub-tasks respecting dependencies
    const completed = new Set<string>();
    const running = new Set<string>();

    while (completed.size < task.subTasks.length) {
      const ready = task.subTasks.filter(
        (st) =>
          st.status === 'pending' &&
          !running.has(st.id) &&
          this.dependenciesMet(st, task.subTasks, completed),
      );

      if (ready.length === 0 && running.size === 0) {
        // Deadlock or all remaining failed
        break;
      }

      // Execute ready sub-tasks in parallel
      await Promise.all(
        ready.map(async (st) => {
          running.add(st.id);
          st.status = 'running';
          st.updatedAt = new Date();

          try {
            // Build context from completed dependencies
            const context = this.buildContext(st, task.subTasks, completed);
            const fullPrompt = context ? `${st.prompt}\n\n--- Context from previous steps ---\n${context}` : st.prompt;

            // Find the agent for this role
            const agent = task.agents.find((a) => a.role === st.agentRole);
            if (!agent) {
              throw new Error(`No agent configured for role: ${st.agentRole}`);
            }

            // Create agent run
            const run = await this.deps.createAgentRun({
              agentId: agent.id,
              prompt: fullPrompt,
              maxSteps: agent.maxSteps,
              userId: task.agents[0]?.id, // Use first agent's context
            });

            st.runId = run.id;
            st.result = run.finalAnswer;
            st.status = run.status === 'failed' ? 'failed' : 'completed';

            log.info({ taskId: task.id, subTaskId: st.id, role: st.agentRole }, 'sub-task completed');

            if (this.deps.onSubTaskComplete) {
              await this.deps.onSubTaskComplete(task, st);
            }
          } catch (err) {
            st.status = 'failed';
            st.result = err instanceof Error ? err.message : 'Unknown error';
            log.error({ taskId: task.id, subTaskId: st.id, err: st.result }, 'sub-task failed');
          } finally {
            running.delete(st.id);
            completed.add(st.id);
            st.updatedAt = new Date();
          }
        }),
      );
    }

    // Check if any sub-task failed
    const hasFailed = task.subTasks.some((st) => st.status === 'failed');
    task.status = hasFailed ? 'failed' : 'synthesizing';
    task.updatedAt = new Date();

    log.info({ taskId: task.id, completed: completed.size, total: task.subTasks.length }, 'execution phase done');
    return task;
  }

  async synthesize(task: SwarmTask, llmSynthesizer: { complete: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string }> }): Promise<SwarmResult> {
    if (task.status === 'failed') {
      return {
        taskId: task.id,
        status: 'failed',
        subTaskResults: task.subTasks.map((st) => ({
          subTaskId: st.id,
          role: st.agentRole,
          result: st.result ?? '',
          status: st.status,
        })),
        finalAnswer: 'One or more sub-tasks failed. Check logs for details.',
        completedAt: new Date(),
      };
    }

    task.status = 'synthesizing';
    log.info({ taskId: task.id }, 'synthesizing results');

    const subTaskOutputs = task.subTasks
      .filter((st) => st.status === 'completed' && st.result)
      .map((st) => `[${st.agentRole.toUpperCase()}] ${st.result}`)
      .join('\n\n');

    const messages = [
      { role: 'system', content: 'You are a synthesizer. Combine the outputs from multiple agents into a single coherent final answer.' },
      { role: 'user', content: `Original task: ${task.originalPrompt}\n\nAgent outputs:\n${subTaskOutputs}\n\nProvide a comprehensive final answer.` },
    ];

    const completion = await llmSynthesizer.complete(messages);
    task.finalAnswer = completion.content;
    task.status = 'completed';
    task.updatedAt = new Date();

    log.info({ taskId: task.id, answerLength: completion.content.length }, 'synthesis complete');

    return {
      taskId: task.id,
      status: 'completed',
      subTaskResults: task.subTasks.map((st) => ({
        subTaskId: st.id,
        role: st.agentRole,
        result: st.result ?? '',
        status: st.status,
      })),
      finalAnswer: completion.content,
      completedAt: new Date(),
    };
  }

  private parsePlan(content: string): Array<{ role: AgentRole; prompt: string; dependsOn?: number }> {
    // Extract JSON array from LLM response
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      // Fallback: single sub-task
      return [{ role: 'executor', prompt: content }];
    }
    try {
      const parsed = JSON.parse(match[0]) as Array<unknown>;
      return parsed.map((item) => ({
        role: String((item as Record<string, unknown>).role ?? 'executor') as AgentRole,
        prompt: String((item as Record<string, unknown>).prompt ?? ''),
        dependsOn: (item as Record<string, unknown>).dependsOn !== undefined ? Number((item as Record<string, unknown>).dependsOn) : undefined,
      }));
    } catch {
      return [{ role: 'executor', prompt: content }];
    }
  }

  private dependenciesMet(subTask: SwarmSubTask, allSubTasks: SwarmSubTask[], completed: Set<string>): boolean {
    if (!subTask.parentId) return true;
    // parentId stores the index of dependency
    const depIndex = parseInt(subTask.parentId, 10);
    if (isNaN(depIndex)) return true;
    const depTask = allSubTasks[depIndex];
    return depTask ? completed.has(depTask.id) : true;
  }

  private buildContext(subTask: SwarmSubTask, allSubTasks: SwarmSubTask[], completed: Set<string>): string {
    if (!subTask.parentId) return '';
    const depIndex = parseInt(subTask.parentId, 10);
    if (isNaN(depIndex)) return '';
    const depTask = allSubTasks[depIndex];
    if (!depTask || !completed.has(depTask.id)) return '';
    return depTask.result ?? '';
  }
}
