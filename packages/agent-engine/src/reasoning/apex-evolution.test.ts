import { describe, it, expect } from 'vitest';
import { ApexEvolution } from './apex-evolution.js';
import type { AgentRun } from '../types.js';

function makeRun(
  status: 'completed' | 'failed',
  steps: number,
  tools: string[],
  prompt = 'test prompt',
  finalAnswer = 'test answer',
): AgentRun {
  return {
    id: `run-${Math.random().toString(36).slice(0, 6)}`,
    agentId: 'agent-1',
    prompt,
    status,
    maxSteps: 10,
    currentStep: steps,
    tokensUsed: 100,
    steps: tools.map((name, i) => ({
      id: `step-${i}`,
      runId: 'run-1',
      index: i,
      status: 'completed' as const,
      action: { name, params: {} },
      observation: { success: true, data: 'result' },
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    finalAnswer,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ApexEvolution', () => {
  it('initializes with single-agent topology', () => {
    const apex = new ApexEvolution();
    const topo = apex.getCurrentTopology();
    expect(topo.type).toBe('single-agent');
    expect(topo.agentCount).toBe(1);
  });

  // Layer 1: Harness Patching
  it('returns null for patch proposal without LLM', async () => {
    const apex = new ApexEvolution();
    const patch = await apex.proposePatch('test-module', 50, ['issue1']);
    expect(patch).toBeNull();
  });

  it('records patch results', async () => {
    const apex = new ApexEvolution();
    // Manually create a patch by calling the internal method through the public interface
    // Since we can't easily test LLM patches, we test the recording mechanism
    apex.recordPatchResult('nonexistent', true, 80, false);
    // Should not throw
    expect(apex.stats().totalPatches).toBe(0);
  });

  // Layer 2: Principle Distillation
  it('extracts principles from successful runs heuristically', async () => {
    const apex = new ApexEvolution();
    const runs = Array.from({ length: 6 }, () => makeRun('completed', 3, ['search', 'read_file', 'write_file']));
    const result = await apex.extractPrinciples(runs);
    expect(result.fromRunCount).toBe(6);
    expect(result.principles.length).toBeGreaterThan(0);
  });

  it('extracts no principles from empty runs', async () => {
    const apex = new ApexEvolution();
    const result = await apex.extractPrinciples([]);
    expect(result.principles.length).toBe(0);
    expect(result.fromRunCount).toBe(0);
  });

  it('extracts tool diversity principle when diverse tools used', async () => {
    const apex = new ApexEvolution();
    const runs = Array.from({ length: 4 }, () => makeRun('completed', 5, ['search', 'read_file', 'write_file', 'bash']));
    const result = await apex.extractPrinciples(runs);
    const hasDiversity = result.principles.some(p => p.name.includes('Diversity'));
    expect(hasDiversity).toBe(true);
  });

  it('applies principles and tracks success rate', async () => {
    const apex = new ApexEvolution();
    const runs = Array.from({ length: 6 }, () => makeRun('completed', 3, ['search', 'read_file', 'write_file', 'bash']));
    await apex.extractPrinciples(runs);
    const principles = apex.getPrinciples();
    expect(principles.length).toBeGreaterThan(0);

    const principle = principles[0];
    apex.applyPrinciple(principle.name, true);
    expect(principle.timesApplied).toBe(1);
    expect(principle.successRate).toBe(100);

    apex.applyPrinciple(principle.name, false);
    expect(principle.timesApplied).toBe(2);
    expect(principle.successRate).toBe(50);
  });

  it('filters principles by category', async () => {
    const apex = new ApexEvolution();
    const runs = Array.from({ length: 6 }, () => makeRun('completed', 3, ['search', 'read_file', 'write_file']));
    await apex.extractPrinciples(runs);
    const efficiency = apex.getPrinciples('efficiency');
    expect(everyHasCategory(efficiency, 'efficiency')).toBe(true);
  });

  it('returns top principles sorted by confidence*successRate', async () => {
    const apex = new ApexEvolution();
    const runs = Array.from({ length: 6 }, () => makeRun('completed', 3, ['search', 'read_file', 'write_file']));
    await apex.extractPrinciples(runs);
    const top = apex.getTopPrinciples(5);
    expect(top.length).toBeLessThanOrEqual(5);
  });

  // Layer 3: Topology Evolution
  it('evolves topology to orchestrator-worker for high parallelism', async () => {
    const apex = new ApexEvolution();
    const result = await apex.evolveTopology({ complexity: 0.6, parallelism: 0.8, sequentiality: 0.2 });
    expect(result).not.toBeNull();
    expect(result!.proposedTopology.type).toBe('orchestrator-worker');
    expect(result!.proposedTopology.agentCount).toBeGreaterThan(1);
  });

  it('evolves topology to hierarchical for high complexity', async () => {
    const apex = new ApexEvolution();
    const result = await apex.evolveTopology({ complexity: 0.9, parallelism: 0.3, sequentiality: 0.5 });
    expect(result).not.toBeNull();
    expect(result!.proposedTopology.type).toBe('hierarchical');
  });

  it('evolves topology to swarm for high parallelism low sequentiality', async () => {
    const apex = new ApexEvolution();
    const result = await apex.evolveTopology({ complexity: 0.5, parallelism: 0.7, sequentiality: 0.2 });
    expect(result).not.toBeNull();
    expect(result!.proposedTopology.type).toBe('swarm');
  });

  it('evolves topology to pipeline for high sequentiality', async () => {
    const apex = new ApexEvolution();
    const result = await apex.evolveTopology({ complexity: 0.4, parallelism: 0.2, sequentiality: 0.8 });
    expect(result).not.toBeNull();
    expect(result!.proposedTopology.type).toBe('pipeline');
  });

  it('returns null when topology stays the same', async () => {
    const apex = new ApexEvolution();
    // Single-agent with low everything → stays single-agent
    const result = await apex.evolveTopology({ complexity: 0.1, parallelism: 0.1, sequentiality: 0.1 });
    expect(result).toBeNull();
  });

  it('applies topology change', async () => {
    const apex = new ApexEvolution();
    const result = await apex.evolveTopology({ complexity: 0.9, parallelism: 0.8, sequentiality: 0.2 });
    expect(result).not.toBeNull();
    apex.applyTopology(result!);
    expect(apex.getCurrentTopology().type).toBe(result!.proposedTopology.type);
  });

  // Combined Cycle
  it('runs full evolution cycle', async () => {
    const apex = new ApexEvolution();
    const runs = Array.from({ length: 5 }, () => makeRun('completed', 4, ['search', 'read_file', 'write_file', 'bash']));
    const result = await apex.runEvolutionCycle(runs, { successRate: 0.9, avgLatency: 500, avgTokens: 200 });
    expect(result.cycle).toBe(1);
    expect(result.layer2Principles.length).toBeGreaterThan(0);
  });

  it('tracks stats across cycles', async () => {
    const apex = new ApexEvolution();
    const runs = Array.from({ length: 6 }, () => makeRun('completed', 3, ['search', 'read_file', 'write_file', 'bash']));
    await apex.runEvolutionCycle(runs);
    await apex.runEvolutionCycle(runs);
    const stats = apex.stats();
    expect(stats.totalCycles).toBe(2);
    expect(stats.totalPrinciples).toBeGreaterThan(0);
  });

  it('clears all state', async () => {
    const apex = new ApexEvolution();
    const runs = Array.from({ length: 6 }, () => makeRun('completed', 3, ['search', 'read_file', 'write_file', 'bash']));
    await apex.runEvolutionCycle(runs);
    apex.clear();
    expect(apex.stats().totalCycles).toBe(0);
    expect(apex.stats().totalPrinciples).toBe(0);
  });
});

function everyHasCategory<T extends { category: string }>(arr: T[], cat: string): boolean {
  return arr.every(item => item.category === cat);
}
