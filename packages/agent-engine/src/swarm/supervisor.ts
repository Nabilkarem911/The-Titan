import { getLogger } from '@titan/logging';
import type { LlmProvider } from '../types.js';
import type { SwarmTask, SwarmSubTask, SwarmAgent, AgentRole } from './types.js';
import type { MessageBus } from './message-bus.js';
import type { SharedWorkspace } from './shared-workspace.js';

const log = getLogger().child({ component: 'swarm-supervisor' });

interface SupervisorDeps {
  llm: LlmProvider;
  messageBus: MessageBus;
  workspace: SharedWorkspace;
}

interface SupervisorDecision {
  action: 'continue' | 'reassign' | 'add_task' | 'remove_task' | 'abort';
  reason: string;
  targetSubTaskId?: string;
  newAgent?: AgentRole;
  newTask?: { prompt: string; role: AgentRole; dependsOn: string[] };
}

const SUPERVISOR_PROMPT = `You are a project supervisor overseeing a multi-agent task. Review the current progress and decide the next action.

Current state will be provided. Respond ONLY with JSON:
{
  "action": "continue|reassign|add_task|remove_task|abort",
  "reason": "Brief explanation",
  "targetSubTaskId": "id if reassign/remove",
  "newAgent": "role if reassign",
  "newTask": { "prompt": "...", "role": "...", "dependsOn": ["..."] }
}

Rules:
- "continue" if everything is on track
- "reassign" if a sub-task failed and another role could handle it
- "add_task" if a gap is discovered
- "remove_task" if a sub-task is redundant
- "abort" only if the overall goal is impossible`;

export class Supervisor {
  private deps: SupervisorDeps;

  constructor(deps: SupervisorDeps) {
    this.deps = deps;
  }

  async evaluate(task: SwarmTask): Promise<SupervisorDecision> {
    const completedCount = task.subTasks.filter((s) => s.status === 'completed').length;
    const failedCount = task.subTasks.filter((s) => s.status === 'failed').length;
    const total = task.subTasks.length;

    // Quick checks before calling LLM
    if (failedCount === 0 && completedCount < total) {
      return { action: 'continue', reason: 'All running tasks progressing normally' };
    }

    if (failedCount > total / 2) {
      return { action: 'abort', reason: `Majority of sub-tasks failed (${failedCount}/${total})` };
    }

    // Use LLM for nuanced decisions
    try {
      const stateDescription = this.describeState(task);
      const workspaceSummary = this.deps.workspace.buildSummary();
      const recentMessages = this.deps.messageBus.getHistory(undefined, 10)
        .map((m) => `[${m.from}→${m.to}] ${m.content.slice(0, 100)}`)
        .join('\n');

      const completion = await this.deps.llm.complete([
        { role: 'system', content: SUPERVISOR_PROMPT },
        {
          role: 'user',
          content: `Goal: ${task.description}\n\nProgress:\n${stateDescription}\n\nWorkspace:\n${workspaceSummary}\n\nRecent messages:\n${recentMessages}`,
        },
      ], { temperature: 0.1 });

      return this.parseDecision(completion.content);
    } catch (err) {
      log.warn({ taskId: task.id, err: err instanceof Error ? err.message : 'Unknown' }, 'supervisor LLM call failed');

      // Fallback: reassign first failed task
      if (failedCount > 0) {
        const failed = task.subTasks.find((s) => s.status === 'failed');
        if (failed) {
          const alternativeRole = this.findAlternativeRole(failed.agentRole, task.agents);
          if (alternativeRole) {
            return { action: 'reassign', reason: 'Auto-reassigning failed task', targetSubTaskId: failed.id, newAgent: alternativeRole };
          }
        }
      }

      return { action: 'continue', reason: 'Fallback — no intervention needed' };
    }
  }

  async broadcastProgress(task: SwarmTask): Promise<void> {
    const completed = task.subTasks.filter((s) => s.status === 'completed').length;
    const total = task.subTasks.length;
    const running = task.subTasks.filter((s) => s.status === 'running');

    await this.deps.messageBus.send({
      from: 'supervisor',
      to: 'broadcast',
      type: 'status',
      content: `Progress: ${completed}/${total} complete. Running: ${running.map((s) => s.agentRole).join(', ') || 'none'}`,
    });
  }

  applyDecision(task: SwarmTask, decision: SupervisorDecision): SwarmTask {
    switch (decision.action) {
      case 'reassign':
        if (decision.targetSubTaskId && decision.newAgent) {
          const subTask = task.subTasks.find((s) => s.id === decision.targetSubTaskId);
          if (subTask) {
            subTask.agentRole = decision.newAgent;
            subTask.status = 'pending';
            subTask.result = undefined;
            log.info({ subTaskId: subTask.id, newRole: decision.newAgent }, 'sub-task reassigned');
          }
        }
        break;

      case 'add_task':
        if (decision.newTask) {
          const newSubTask: SwarmSubTask = {
            id: `added_${Date.now()}`,
            agentRole: decision.newTask.role,
            prompt: decision.newTask.prompt,
            parentId: decision.newTask.dependsOn.length > 0 ? JSON.stringify(decision.newTask.dependsOn) : undefined,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          task.subTasks.push(newSubTask);
          log.info({ subTaskId: newSubTask.id, role: newSubTask.agentRole }, 'sub-task added by supervisor');
        }
        break;

      case 'remove_task':
        if (decision.targetSubTaskId) {
          const idx = task.subTasks.findIndex((s) => s.id === decision.targetSubTaskId);
          if (idx >= 0 && task.subTasks[idx].status === 'pending') {
            task.subTasks.splice(idx, 1);
            log.info({ subTaskId: decision.targetSubTaskId }, 'sub-task removed by supervisor');
          }
        }
        break;

      case 'abort':
        task.status = 'failed';
        task.finalAnswer = `Aborted by supervisor: ${decision.reason}`;
        log.warn({ taskId: task.id, reason: decision.reason }, 'task aborted by supervisor');
        break;
    }

    task.updatedAt = new Date();
    return task;
  }

  private describeState(task: SwarmTask): string {
    return task.subTasks
      .map((s) => {
        const status = s.status === 'completed' ? '✓' : s.status === 'failed' ? '✗' : s.status === 'running' ? '⟳' : '○';
        const result = s.result ? ` → ${s.result.slice(0, 150)}` : '';
        return `${status} [${s.agentRole}] ${s.prompt.slice(0, 100)}${result}`;
      })
      .join('\n');
  }

  private findAlternativeRole(failedRole: AgentRole, agents: SwarmAgent[]): AgentRole | undefined {
    const alternatives: Record<string, AgentRole[]> = {
      researcher: ['executor', 'coder'],
      coder: ['executor', 'reviewer'],
      executor: ['coder', 'researcher'],
      reviewer: ['synthesizer', 'researcher'],
      synthesizer: ['reviewer', 'executor'],
      planner: ['researcher', 'synthesizer'],
    };

    const options = alternatives[failedRole] ?? [];
    return options.find((role) => agents.some((a) => a.role === role));
  }

  private parseDecision(content: string): SupervisorDecision {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return { action: 'continue', reason: 'Could not parse supervisor response' };
    }

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const validActions = ['continue', 'reassign', 'add_task', 'remove_task', 'abort'];
      const action = validActions.includes(String(parsed.action))
        ? (String(parsed.action) as SupervisorDecision['action'])
        : 'continue';

      return {
        action,
        reason: String(parsed.reason ?? ''),
        targetSubTaskId: parsed.targetSubTaskId ? String(parsed.targetSubTaskId) : undefined,
        newAgent: parsed.newAgent ? (String(parsed.newAgent) as AgentRole) : undefined,
        newTask: parsed.newTask && typeof parsed.newTask === 'object'
          ? {
              prompt: String((parsed.newTask as Record<string, unknown>).prompt ?? ''),
              role: String((parsed.newTask as Record<string, unknown>).role ?? 'executor') as AgentRole,
              dependsOn: Array.isArray((parsed.newTask as Record<string, unknown>).dependsOn)
                ? ((parsed.newTask as Record<string, unknown>).dependsOn as unknown[]).map(String)
                : [],
            }
          : undefined,
      };
    } catch {
      return { action: 'continue', reason: 'Parse error' };
    }
  }
}
