import { getLogger } from '@titan/logging';
import type { LlmProvider, LlmToolDefinition } from '../types.js';
import type { ExecutionPlan, PlanValidationResult } from './types.js';
import { validateDependencies, getExecutionOrder } from './dependency-graph.js';

const log = getLogger().child({ component: 'plan-validator' });

const VALIDATION_PROMPT = `You are a plan reviewer. Given a plan (goal + steps), identify problems.

Check for:
1. Steps that are unclear or too vague to execute
2. Missing steps (gaps in logic)
3. Steps in wrong order
4. Redundant steps that do the same thing
5. Steps that reference unavailable tools

Respond ONLY with JSON:
{
  "valid": true/false,
  "issues": [
    { "stepId": "step_1", "severity": "critical|warning|info", "message": "..." }
  ]
}`;

export class PlanValidator {
  constructor(private llm: LlmProvider) {}

  validateStructure(plan: ExecutionPlan): PlanValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (plan.steps.length === 0) {
      errors.push('Plan has no steps');
    }

    if (plan.steps.length > 20) {
      warnings.push(`Plan has ${plan.steps.length} steps — consider simplifying`);
    }

    const ids = new Set<string>();
    for (const step of plan.steps) {
      if (ids.has(step.id)) {
        errors.push(`Duplicate step ID: "${step.id}"`);
      }
      ids.add(step.id);

      if (!step.description || step.description.trim().length < 5) {
        errors.push(`Step "${step.id}" has no meaningful description`);
      }
    }

    const depResult = validateDependencies(plan.steps);
    errors.push(...depResult.errors);
    warnings.push(...depResult.warnings);

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateSemantics(
    plan: ExecutionPlan,
    availableTools?: LlmToolDefinition[],
  ): Promise<PlanValidationResult> {
    const structureResult = this.validateStructure(plan);
    if (!structureResult.valid) {
      return structureResult;
    }

    const errors: string[] = [...structureResult.errors];
    const warnings: string[] = [...structureResult.warnings];

    if (availableTools) {
      for (const step of plan.steps) {
        if (step.toolHint && !availableTools.some((t) => t.name === step.toolHint)) {
          warnings.push(`Step "${step.id}" hints at unknown tool "${step.toolHint}"`);
        }
      }
    }

    try {
      const executionOrder = getExecutionOrder(plan.steps);
      const stepsDescription = plan.steps
        .map((s) => `- [${s.id}] ${s.description} (depends on: ${s.dependsOn.join(', ') || 'none'})`)
        .join('\n');

      const toolList = availableTools
        ? `\nAvailable tools: ${availableTools.map((t) => t.name).join(', ')}`
        : '';

      const completion = await this.llm.complete([
        { role: 'system', content: VALIDATION_PROMPT },
        { role: 'user', content: `Goal: ${plan.goal}\n\nSteps:\n${stepsDescription}${toolList}` },
      ], { temperature: 0.1 });

      const parsed = this.parseLlmValidation(completion.content);
      for (const issue of parsed) {
        if (issue.severity === 'critical') {
          errors.push(`[${issue.stepId}] ${issue.message}`);
        } else {
          warnings.push(`[${issue.stepId}] ${issue.message}`);
        }
      }

      log.info({ planId: plan.id, parallelLayers: executionOrder.length }, 'semantic validation complete');
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'LLM validation failed — using structural validation only');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private parseLlmValidation(content: string): Array<{ stepId: string; severity: string; message: string }> {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];

    try {
      const parsed = JSON.parse(match[0]) as { issues?: unknown[] };
      if (!Array.isArray(parsed.issues)) return [];

      return parsed.issues.map((item) => {
        const raw = item as Record<string, unknown>;
        return {
          stepId: String(raw.stepId ?? 'unknown'),
          severity: String(raw.severity ?? 'info'),
          message: String(raw.message ?? ''),
        };
      });
    } catch {
      return [];
    }
  }
}
