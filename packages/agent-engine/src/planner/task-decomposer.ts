import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { LlmProvider, LlmToolDefinition } from '../types.js';
import type { ExecutionPlan, PlanStep, TaskDecomposerDeps } from './types.js';
import { validateDependencies } from './dependency-graph.js';

const log = getLogger().child({ component: 'task-decomposer' });

const DECOMPOSE_PROMPT = `You are a task planning expert. Given a user's goal, break it down into a sequence of concrete, actionable steps.

Rules:
1. Each step must be a single, clear action — not a vague goal.
2. Use "dependsOn" to indicate which step IDs must complete before this one can start. Use empty array [] for independent steps.
3. If a step needs a specific tool, set "toolHint" to the tool name.
4. Keep the plan minimal — don't add unnecessary steps.
5. Steps that can run in parallel should NOT depend on each other.

Respond ONLY with a JSON object in this exact format:
{
  "steps": [
    { "id": "step_1", "description": "...", "toolHint": "tool_name_or_null", "dependsOn": [] },
    { "id": "step_2", "description": "...", "toolHint": null, "dependsOn": ["step_1"] }
  ]
}`;

export class TaskDecomposer {
  private llm: LlmProvider;

  constructor(deps: TaskDecomposerDeps) {
    this.llm = deps.llm;
  }

  async decompose(
    goal: string,
    availableTools?: LlmToolDefinition[],
  ): Promise<ExecutionPlan> {
    const toolList = availableTools
      ? `\n\nAvailable tools:\n${availableTools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}`
      : '';

    const completion = await this.llm.complete([
      { role: 'system', content: DECOMPOSE_PROMPT },
      { role: 'user', content: `Goal: ${goal}${toolList}` },
    ], { temperature: 0.3 });

    const steps = this.parseSteps(completion.content);
    const plan: ExecutionPlan = {
      id: randomUUID(),
      goal,
      steps,
      currentStepIndex: 0,
      status: 'draft',
      revisionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const validation = validateDependencies(steps);
    if (!validation.valid) {
      log.warn({ planId: plan.id, errors: validation.errors }, 'plan has dependency issues — auto-fixing');
      plan.steps = this.autoFixDependencies(steps);
    }

    log.info({ planId: plan.id, steps: plan.steps.length }, 'task decomposed');
    return plan;
  }

  isComplexTask(prompt: string): boolean {
    const complexitySignals = [
      /\band\b.*\band\b/i,
      /\bthen\b/i,
      /\bafter\b.*\b(do|make|create|run)\b/i,
      /\bfirst\b.*\bthen\b/i,
      /\bstep[s]?\b/i,
      /\bmultiple\b/i,
      /\bcompare\b/i,
      /\banalyze\b.*\band\b/i,
      /\bbuild\b.*\bwith\b/i,
      /\bresearch\b.*\b(and|then)\b/i,
    ];

    const matchCount = complexitySignals.filter((r) => r.test(prompt)).length;
    const wordCount = prompt.split(/\s+/).length;

    return matchCount >= 2 || wordCount > 50;
  }

  private parseSteps(content: string): PlanStep[] {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [this.fallbackStep(content)];
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as { steps?: unknown[] };
      if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
        return [this.fallbackStep(content)];
      }

      return parsed.steps.map((raw, i) => {
        const item = raw as Record<string, unknown>;
        return {
          id: String(item.id ?? `step_${i + 1}`),
          description: String(item.description ?? ''),
          toolHint: item.toolHint ? String(item.toolHint) : undefined,
          dependsOn: Array.isArray(item.dependsOn)
            ? item.dependsOn.map(String)
            : [],
          status: 'pending' as const,
          retries: 0,
        };
      });
    } catch {
      return [this.fallbackStep(content)];
    }
  }

  private fallbackStep(content: string): PlanStep {
    return {
      id: 'step_1',
      description: content.slice(0, 500),
      dependsOn: [],
      status: 'pending',
      retries: 0,
    };
  }

  private autoFixDependencies(steps: PlanStep[]): PlanStep[] {
    const ids = new Set(steps.map((s) => s.id));
    return steps.map((s) => ({
      ...s,
      dependsOn: s.dependsOn.filter((d) => ids.has(d) && d !== s.id),
    }));
  }
}
