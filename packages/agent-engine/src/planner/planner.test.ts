import { describe, it, expect, vi } from 'vitest';
import { TaskDecomposer } from './task-decomposer.js';
import { PlanValidator } from './plan-validator.js';
import { PlanReviser } from './plan-reviser.js';
import {
  buildDependencyGraph,
  detectCycles,
  getExecutionOrder,
  getReadySteps,
  validateDependencies,
} from './dependency-graph.js';
import type { PlanStep, ExecutionPlan } from './types.js';
import type { LlmProvider } from '../types.js';

function mockLlm(content: string): LlmProvider {
  return {
    complete: vi.fn().mockResolvedValue({ content, tokensUsed: 100, finishReason: 'stop' }),
  };
}

function makePlan(steps: Partial<PlanStep>[]): ExecutionPlan {
  return {
    id: 'plan-1',
    goal: 'Test goal',
    steps: steps.map((s, i) => ({
      id: s.id ?? `step_${i + 1}`,
      description: s.description ?? `Step ${i + 1}`,
      dependsOn: s.dependsOn ?? [],
      status: s.status ?? 'pending',
      retries: s.retries ?? 0,
      ...s,
    })),
    currentStepIndex: 0,
    status: 'draft',
    revisionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ── Dependency Graph ──

describe('dependency-graph', () => {
  it('builds graph with correct depths', () => {
    const steps: PlanStep[] = [
      { id: 'a', description: 'A', dependsOn: [], status: 'pending', retries: 0 },
      { id: 'b', description: 'B', dependsOn: ['a'], status: 'pending', retries: 0 },
      { id: 'c', description: 'C', dependsOn: ['b'], status: 'pending', retries: 0 },
    ];
    const graph = buildDependencyGraph(steps);
    expect(graph.get('a')!.depth).toBe(0);
    expect(graph.get('b')!.depth).toBe(1);
    expect(graph.get('c')!.depth).toBe(2);
  });

  it('computes dependedBy correctly', () => {
    const steps: PlanStep[] = [
      { id: 'a', description: 'A', dependsOn: [], status: 'pending', retries: 0 },
      { id: 'b', description: 'B', dependsOn: ['a'], status: 'pending', retries: 0 },
      { id: 'c', description: 'C', dependsOn: ['a'], status: 'pending', retries: 0 },
    ];
    const graph = buildDependencyGraph(steps);
    expect(graph.get('a')!.dependedBy).toEqual(['b', 'c']);
  });

  it('detects cycles', () => {
    const steps: PlanStep[] = [
      { id: 'a', description: 'A', dependsOn: ['c'], status: 'pending', retries: 0 },
      { id: 'b', description: 'B', dependsOn: ['a'], status: 'pending', retries: 0 },
      { id: 'c', description: 'C', dependsOn: ['b'], status: 'pending', retries: 0 },
    ];
    const cycles = detectCycles(steps);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('returns empty for no cycles', () => {
    const steps: PlanStep[] = [
      { id: 'a', description: 'A', dependsOn: [], status: 'pending', retries: 0 },
      { id: 'b', description: 'B', dependsOn: ['a'], status: 'pending', retries: 0 },
    ];
    expect(detectCycles(steps)).toEqual([]);
  });

  it('computes execution order in layers', () => {
    const steps: PlanStep[] = [
      { id: 'a', description: 'A', dependsOn: [], status: 'pending', retries: 0 },
      { id: 'b', description: 'B', dependsOn: [], status: 'pending', retries: 0 },
      { id: 'c', description: 'C', dependsOn: ['a', 'b'], status: 'pending', retries: 0 },
    ];
    const layers = getExecutionOrder(steps);
    expect(layers.length).toBe(2);
    expect(layers[0].map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(layers[1].map((s) => s.id)).toEqual(['c']);
  });

  it('finds ready steps', () => {
    const steps: PlanStep[] = [
      { id: 'a', description: 'A', dependsOn: [], status: 'completed', retries: 0 },
      { id: 'b', description: 'B', dependsOn: ['a'], status: 'pending', retries: 0 },
      { id: 'c', description: 'C', dependsOn: ['b'], status: 'pending', retries: 0 },
    ];
    const ready = getReadySteps(steps);
    expect(ready.map((s) => s.id)).toEqual(['b']);
  });

  it('validates missing dependencies', () => {
    const steps: PlanStep[] = [
      { id: 'a', description: 'A', dependsOn: ['missing'], status: 'pending', retries: 0 },
    ];
    const result = validateDependencies(steps);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('unknown step');
  });

  it('validates self-dependency', () => {
    const steps: PlanStep[] = [
      { id: 'a', description: 'A', dependsOn: ['a'], status: 'pending', retries: 0 },
    ];
    const result = validateDependencies(steps);
    expect(result.valid).toBe(false);
  });
});

// ── Task Decomposer ──

describe('TaskDecomposer', () => {
  it('decomposes a task from LLM response', async () => {
    const llm = mockLlm(JSON.stringify({
      steps: [
        { id: 'step_1', description: 'Search for info', toolHint: 'brave_search', dependsOn: [] },
        { id: 'step_2', description: 'Summarize results', dependsOn: ['step_1'] },
      ],
    }));

    const decomposer = new TaskDecomposer({ llm });
    const plan = await decomposer.decompose('Research and summarize topic X');
    expect(plan.steps.length).toBe(2);
    expect(plan.steps[0].toolHint).toBe('brave_search');
    expect(plan.steps[1].dependsOn).toEqual(['step_1']);
  });

  it('handles invalid JSON gracefully', async () => {
    const llm = mockLlm('Not JSON at all');
    const decomposer = new TaskDecomposer({ llm });
    const plan = await decomposer.decompose('Do something');
    expect(plan.steps.length).toBe(1);
  });

  it('auto-fixes invalid dependencies', async () => {
    const llm = mockLlm(JSON.stringify({
      steps: [
        { id: 'step_1', description: 'Do A', dependsOn: ['nonexistent'] },
        { id: 'step_2', description: 'Do B', dependsOn: ['step_1'] },
      ],
    }));

    const decomposer = new TaskDecomposer({ llm });
    const plan = await decomposer.decompose('Test');
    expect(plan.steps[0].dependsOn).toEqual([]);
    expect(plan.steps[1].dependsOn).toEqual(['step_1']);
  });

  it('detects complex tasks', () => {
    const decomposer = new TaskDecomposer({ llm: mockLlm('') });
    expect(decomposer.isComplexTask('What is 2+2?')).toBe(false);
    expect(decomposer.isComplexTask('Research the topic and then compare the results and build a summary report with charts')).toBe(true);
  });
});

// ── Plan Validator ──

describe('PlanValidator', () => {
  it('validates a correct plan structure', () => {
    const plan = makePlan([
      { id: 'a', description: 'Do something' },
      { id: 'b', description: 'Do another thing', dependsOn: ['a'] },
    ]);
    const validator = new PlanValidator(mockLlm(''));
    const result = validator.validateStructure(plan);
    expect(result.valid).toBe(true);
  });

  it('rejects empty plan', () => {
    const plan = makePlan([]);
    const validator = new PlanValidator(mockLlm(''));
    const result = validator.validateStructure(plan);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('no steps');
  });

  it('rejects duplicate IDs', () => {
    const plan = makePlan([
      { id: 'a', description: 'First' },
      { id: 'a', description: 'Duplicate' },
    ]);
    const validator = new PlanValidator(mockLlm(''));
    const result = validator.validateStructure(plan);
    expect(result.valid).toBe(false);
  });

  it('warns about too many steps', () => {
    const steps = Array.from({ length: 25 }, (_, i) => ({ id: `s${i}`, description: `Step ${i}` }));
    const plan = makePlan(steps);
    const validator = new PlanValidator(mockLlm(''));
    const result = validator.validateStructure(plan);
    expect(result.warnings.some((w) => w.includes('simplifying'))).toBe(true);
  });
});

// ── Plan Reviser ──

describe('PlanReviser', () => {
  it('revises a plan after step failure', async () => {
    const llm = mockLlm(JSON.stringify({
      steps: [
        { id: 'step_1', description: 'Done', status: 'completed', dependsOn: [] },
        { id: 'step_revised_1', description: 'Alternative approach', dependsOn: ['step_1'], status: 'pending' },
      ],
    }));

    const plan = makePlan([
      { id: 'step_1', description: 'Done', status: 'completed' },
      { id: 'step_2', description: 'Failed step', status: 'failed', error: 'timeout' },
    ]);

    const reviser = new PlanReviser(llm);
    const revision = await reviser.revise(plan, 'step_2', 'timeout');
    expect(revision).not.toBeNull();
    expect(revision!.revisedPlan.revisionCount).toBe(1);
  });

  it('returns null after max revisions', async () => {
    const plan = makePlan([{ id: 'a', description: 'Test' }]);
    plan.revisionCount = 3;
    const reviser = new PlanReviser(mockLlm(''));
    const result = await reviser.revise(plan, 'a', 'error');
    expect(result).toBeNull();
  });

  it('falls back to retry when LLM returns invalid JSON', async () => {
    const llm = mockLlm('not json');
    const plan = makePlan([
      { id: 'a', description: 'OK', status: 'completed' },
      { id: 'b', description: 'Failed', status: 'failed' },
    ]);

    const reviser = new PlanReviser(llm);
    const revision = await reviser.revise(plan, 'b', 'error');
    expect(revision).not.toBeNull();
    const pendingSteps = revision!.revisedPlan.steps.filter((s) => s.status === 'pending');
    expect(pendingSteps.length).toBeGreaterThan(0);
  });
});
