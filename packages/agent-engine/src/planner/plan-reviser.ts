import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { LlmProvider } from '../types.js';
import type { ExecutionPlan, PlanStep, PlanRevision } from './types.js';
import { validateDependencies } from './dependency-graph.js';

const log = getLogger().child({ component: 'plan-reviser' });

const MAX_REVISIONS = 3;

const REVISE_PROMPT = `You are a plan revision expert. A step in the current plan has failed. Revise the remaining plan to work around the failure.

Rules:
1. Keep completed steps as-is — do NOT modify them.
2. You may: add new steps, modify pending steps, remove unnecessary steps, or reorder pending steps.
3. Steps must have unique IDs. New steps should use IDs like "step_revised_1", "step_revised_2", etc.
4. Preserve the original goal.

Respond ONLY with JSON:
{
  "steps": [
    { "id": "step_1", "description": "...", "toolHint": "tool_name_or_null", "dependsOn": [], "status": "completed" },
    { "id": "step_revised_1", "description": "...", "toolHint": null, "dependsOn": ["step_1"], "status": "pending" }
  ]
}`;

export class PlanReviser {
  constructor(private llm: LlmProvider) {}

  async revise(
    plan: ExecutionPlan,
    failedStepId: string,
    failureReason: string,
  ): Promise<PlanRevision | null> {
    if (plan.revisionCount >= MAX_REVISIONS) {
      log.warn({ planId: plan.id, revisions: plan.revisionCount }, 'max revisions reached');
      return null;
    }

    const failedStep = plan.steps.find((s) => s.id === failedStepId);
    if (!failedStep) {
      log.warn({ planId: plan.id, failedStepId }, 'failed step not found in plan');
      return null;
    }

    const stepsDescription = plan.steps
      .map((s) => {
        const statusTag = s.status === 'completed' ? '✓' : s.status === 'failed' ? '✗' : '○';
        const result = s.result ? ` → Result: ${s.result.slice(0, 200)}` : '';
        const error = s.error ? ` → Error: ${s.error.slice(0, 200)}` : '';
        return `${statusTag} [${s.id}] ${s.description} (status: ${s.status})${result}${error}`;
      })
      .join('\n');

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: REVISE_PROMPT },
        {
          role: 'user',
          content: `Goal: ${plan.goal}\n\nCurrent plan:\n${stepsDescription}\n\nFailed step: "${failedStepId}" — ${failedStep.description}\nFailure reason: ${failureReason}\n\nRevise the plan to achieve the goal despite this failure.`,
        },
      ], { temperature: 0.3 });

      const revisedSteps = this.parseRevisedSteps(completion.content, plan.steps);

      const validation = validateDependencies(revisedSteps);
      if (!validation.valid) {
        log.warn({ planId: plan.id, errors: validation.errors }, 'revised plan has issues');
        const fixed = this.autoFixDependencies(revisedSteps);
        return this.buildRevision(plan, failedStepId, failureReason, fixed);
      }

      return this.buildRevision(plan, failedStepId, failureReason, revisedSteps);
    } catch (err) {
      log.error({ planId: plan.id, err: err instanceof Error ? err.message : 'Unknown' }, 'plan revision failed');
      return null;
    }
  }

  canRevise(plan: ExecutionPlan): boolean {
    return plan.revisionCount < MAX_REVISIONS;
  }

  private buildRevision(
    originalPlan: ExecutionPlan,
    failedStepId: string,
    reason: string,
    revisedSteps: PlanStep[],
  ): PlanRevision {
    const revisedPlan: ExecutionPlan = {
      ...originalPlan,
      id: randomUUID(),
      steps: revisedSteps,
      status: 'active',
      revisionCount: originalPlan.revisionCount + 1,
      updatedAt: new Date(),
    };

    log.info({
      originalPlanId: originalPlan.id,
      revisedPlanId: revisedPlan.id,
      revision: revisedPlan.revisionCount,
      steps: revisedSteps.length,
    }, 'plan revised');

    return {
      reason,
      failedStepId,
      originalPlan,
      revisedPlan,
      timestamp: new Date(),
    };
  }

  private parseRevisedSteps(content: string, currentSteps: PlanStep[]): PlanStep[] {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return this.fallbackRevision(currentSteps);
    }

    try {
      const parsed = JSON.parse(match[0]) as { steps?: unknown[] };
      if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
        return this.fallbackRevision(currentSteps);
      }

      const completedMap = new Map(
        currentSteps.filter((s) => s.status === 'completed').map((s) => [s.id, s]),
      );

      return parsed.steps.map((raw) => {
        const item = raw as Record<string, unknown>;
        const id = String(item.id ?? randomUUID());

        const existing = completedMap.get(id);
        if (existing) return existing;

        return {
          id,
          description: String(item.description ?? ''),
          toolHint: item.toolHint ? String(item.toolHint) : undefined,
          dependsOn: Array.isArray(item.dependsOn) ? item.dependsOn.map(String) : [],
          status: (String(item.status ?? 'pending') === 'completed' ? 'completed' : 'pending') as PlanStep['status'],
          retries: 0,
        };
      });
    } catch {
      return this.fallbackRevision(currentSteps);
    }
  }

  private fallbackRevision(currentSteps: PlanStep[]): PlanStep[] {
    return currentSteps.map((s) => {
      if (s.status === 'failed') {
        return { ...s, status: 'pending' as const, retries: s.retries + 1, error: undefined };
      }
      return s;
    });
  }

  private autoFixDependencies(steps: PlanStep[]): PlanStep[] {
    const ids = new Set(steps.map((s) => s.id));
    return steps.map((s) => ({
      ...s,
      dependsOn: s.dependsOn.filter((d) => ids.has(d) && d !== s.id),
    }));
  }
}
