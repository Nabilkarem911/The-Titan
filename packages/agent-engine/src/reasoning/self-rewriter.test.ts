import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelfRewriter } from './self-rewriter.js';
import type { LlmProvider } from '../types.js';

function makeMockLLM(responses: string[]): LlmProvider {
  let idx = 0;
  return {
    complete: vi.fn(async () => ({
      content: responses[idx++] ?? responses[responses.length - 1],
      model: 'test-model',
      tokensUsed: { input: 10, output: 20, total: 30 },
      finishReason: 'stop',
    })),
  } as unknown as LlmProvider;
}

const DIAGNOSIS_RESPONSE = JSON.stringify({
  bottlenecks: [
    { module: 'planner', issue: 'Too many planning steps', severity: 'high', evidence: 'avg 12 steps vs optimal 5' },
    { module: 'tool-selector', issue: 'Poor tool selection', severity: 'medium', evidence: '30% wrong tool choices' },
  ],
  rootCause: 'Planning module over-decomposes simple tasks',
  recommendedFix: 'Add complexity check before decomposition',
  healthScore: 65,
});

const PLAN_RESPONSE = JSON.stringify({
  targetModule: 'planner',
  changeDescription: 'Add complexity gate before decomposition',
  steps: [
    { action: 'Add complexity scoring function', target: 'planner.ts:45', expectedEffect: 'Reduces unnecessary decomposition' },
    { action: 'Skip decomposition for simple tasks', target: 'planner.ts:78', expectedEffect: 'Fewer steps for simple tasks' },
  ],
  riskLevel: 'low',
  requiresHumanApproval: false,
  estimatedImprovement: 15,
});

const PROPOSAL_RESPONSE = JSON.stringify({
  targetModule: 'planner',
  proposedChange: 'Add complexity gate before decomposition',
  proposedCode: 'function shouldDecompose(task) { return task.complexity > 0.6; }',
  expectedImprovement: '15% fewer steps for simple tasks',
  confidence: 78,
  riskLevel: 'low',
});

const EVAL_RESPONSE = JSON.stringify({
  improved: true,
  keepChange: true,
  performanceAfter: 65,
  reasoning: 'Fewer steps observed for simple tasks',
});

describe('SelfRewriter — Phase 1.1 Source-Level Pipeline', () => {
  let rewriter: SelfRewriter;

  beforeEach(() => {
    const llm = makeMockLLM([
      DIAGNOSIS_RESPONSE,
      PLAN_RESPONSE,
      PROPOSAL_RESPONSE,
      EVAL_RESPONSE,
    ]);
    rewriter = new SelfRewriter(llm);
  });

  it('diagnoses performance issues', async () => {
    const diagnosis = await rewriter.diagnose({
      successRate: 60,
      avgDuration: 5000,
      avgTokens: 2000,
      errorPatterns: ['timeout', 'wrong tool'],
    });

    expect(diagnosis).not.toBeNull();
    expect(diagnosis!.bottlenecks.length).toBe(2);
    expect(diagnosis!.bottlenecks[0].module).toBe('planner');
    expect(diagnosis!.rootCause).toContain('over-decomposes');
    expect(diagnosis!.healthScore).toBe(65);
  });

  it('creates a rewrite plan from diagnosis', async () => {
    const diagnosis = await rewriter.diagnose({
      successRate: 60,
      avgDuration: 5000,
      avgTokens: 2000,
      errorPatterns: ['timeout'],
    });
    const plan = await rewriter.planRewrite(diagnosis!);

    expect(plan).not.toBeNull();
    expect(plan!.targetModule).toBe('planner');
    expect(plan!.steps.length).toBe(2);
    expect(plan!.riskLevel).toBe('low');
    expect(plan!.requiresHumanApproval).toBe(false);
    expect(plan!.estimatedImprovement).toBe(15);
  });

  it('requires human approval for high-risk plans', async () => {
    const highRiskPlan = JSON.stringify({
      targetModule: 'runner',
      changeDescription: 'Rewrite core execution loop',
      steps: [{ action: 'Replace loop', target: 'runner.ts', expectedEffect: 'Faster execution' }],
      riskLevel: 'high',
      requiresHumanApproval: true,
      estimatedImprovement: 25,
    });
    const llm = makeMockLLM([DIAGNOSIS_RESPONSE, highRiskPlan, PROPOSAL_RESPONSE, EVAL_RESPONSE]);
    rewriter = new SelfRewriter(llm);

    const diagnosis = await rewriter.diagnose({
      successRate: 60, avgDuration: 5000, avgTokens: 2000, errorPatterns: [],
    });
    const plan = await rewriter.planRewrite(diagnosis!);

    expect(plan!.riskLevel).toBe('high');
    expect(plan!.requiresHumanApproval).toBe(true);
  });

  it('runs full pipeline successfully', async () => {
    const pipeline = await rewriter.runFullPipeline({
      successRate: 60,
      avgDuration: 5000,
      avgTokens: 2000,
      errorPatterns: ['timeout'],
    });

    expect(pipeline.phase).toBe('completed');
    expect(pipeline.diagnosis).not.toBeNull();
    expect(pipeline.plan).not.toBeNull();
    expect(pipeline.proposal).not.toBeNull();
    expect(pipeline.result).not.toBeNull();
    expect(pipeline.result!.improved).toBe(true);
    expect(pipeline.result!.applied).toBe(true);
    expect(pipeline.completedAt).toBeDefined();
  });

  it('runs full pipeline with sandbox test', async () => {
    const sandboxTest = vi.fn(async () => ({ passed: true, score: 80 }));
    const pipeline = await rewriter.runFullPipeline(
      { successRate: 60, avgDuration: 5000, avgTokens: 2000, errorPatterns: [] },
      { sandboxTest },
    );

    expect(pipeline.phase).toBe('completed');
    expect(sandboxTest).toHaveBeenCalled();
  });

  it('aborts pipeline when sandbox test fails', async () => {
    const sandboxTest = vi.fn(async () => ({ passed: false, score: 20 }));
    const pipeline = await rewriter.runFullPipeline(
      { successRate: 60, avgDuration: 5000, avgTokens: 2000, errorPatterns: [] },
      { sandboxTest },
    );

    expect(pipeline.phase).toBe('failed');
  });

  it('runs health probe after deployment', async () => {
    const healthProbe = vi.fn(async () => [
      { name: 'api_health', passed: true, details: 'OK', durationMs: 10 },
      { name: 'db_health', passed: true, details: 'OK', durationMs: 5 },
    ]);
    const pipeline = await rewriter.runFullPipeline(
      { successRate: 60, avgDuration: 5000, avgTokens: 2000, errorPatterns: [] },
      { healthProbe },
    );

    expect(pipeline.phase).toBe('completed');
    expect(healthProbe).toHaveBeenCalled();
  });

  it('auto-rollbacks when health probe fails', async () => {
    const llm = makeMockLLM([DIAGNOSIS_RESPONSE, PLAN_RESPONSE, PROPOSAL_RESPONSE, EVAL_RESPONSE]);
    rewriter = new SelfRewriter(llm);
    const healthProbe = vi.fn(async () => [
      { name: 'api_health', passed: true, details: 'OK', durationMs: 10 },
      { name: 'critical_check', passed: false, details: 'CRITICAL FAIL', durationMs: 5 },
    ]);
    const pipeline = await rewriter.runFullPipeline(
      { successRate: 60, avgDuration: 5000, avgTokens: 2000, errorPatterns: [] },
      { healthProbe },
    );

    expect(pipeline.result!.applied).toBe(false);
    expect(pipeline.result!.rolledBack).toBe(true);
  });

  it('rejects pipeline at human approval gate', async () => {
    const highRiskPlan = JSON.stringify({
      targetModule: 'runner',
      changeDescription: 'Rewrite core loop',
      steps: [{ action: 'replace', target: 'runner.ts', expectedEffect: 'faster' }],
      riskLevel: 'high',
      requiresHumanApproval: true,
      estimatedImprovement: 25,
    });
    const llm = makeMockLLM([DIAGNOSIS_RESPONSE, highRiskPlan, PROPOSAL_RESPONSE, EVAL_RESPONSE]);
    rewriter = new SelfRewriter(llm);

    const humanApproval = vi.fn(async () => false);
    const pipeline = await rewriter.runFullPipeline(
      { successRate: 60, avgDuration: 5000, avgTokens: 2000, errorPatterns: [] },
      { humanApproval },
    );

    expect(pipeline.phase).toBe('failed');
    expect(humanApproval).toHaveBeenCalled();
  });

  it('lists pipelines sorted by start time', async () => {
    await rewriter.runFullPipeline({ successRate: 60, avgDuration: 5000, avgTokens: 2000, errorPatterns: [] });
    const llm2 = makeMockLLM([DIAGNOSIS_RESPONSE, PLAN_RESPONSE, PROPOSAL_RESPONSE, EVAL_RESPONSE]);
    rewriter = new SelfRewriter(llm2);
    await rewriter.runFullPipeline({ successRate: 55, avgDuration: 4000, avgTokens: 1800, errorPatterns: [] });

    const list = rewriter.listPipelines();
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('tracks stats', () => {
    const stats = rewriter.stats();
    expect(stats.totalVersions).toBe(0);
    expect(stats.currentVersion).toBe(0);
    expect(stats.improvementRate).toBe(0);
  });
});
