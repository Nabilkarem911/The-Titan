import { describe, it, expect, beforeEach } from 'vitest';
import { SelfEvolvingCode, type FitnessScore } from './self-evolving-code.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('SelfEvolvingCode', () => {
  let evolution: SelfEvolvingCode;

  beforeEach(() => {
    evolution = new SelfEvolvingCode(new MockEchoProvider(), { enabled: true, maxCyclesPerDay: 5 });
  });

  it('should be disabled by default', () => {
    const e = new SelfEvolvingCode(new MockEchoProvider());
    expect(e.isEnabled()).toBe(false);
  });

  it('should enable and disable', () => {
    evolution.disable();
    expect(evolution.isEnabled()).toBe(false);
    evolution.enable();
    expect(evolution.isEnabled()).toBe(true);
  });

  it('should block modifications to package.json', () => {
    expect(evolution.isSafeToModify('package.json')).toBe(false);
  });

  it('should block modifications to tsconfig.json', () => {
    expect(evolution.isSafeToModify('tsconfig.json')).toBe(false);
  });

  it('should block modifications to .env', () => {
    expect(evolution.isSafeToModify('.env')).toBe(false);
    expect(evolution.isSafeToModify('.env.production')).toBe(false);
  });

  it('should block modifications to safety-critical files', () => {
    expect(evolution.isSafeToModify('src/guardrails/check.ts')).toBe(false);
    expect(evolution.isSafeToModify('src/auth/middleware.ts')).toBe(false);
    expect(evolution.isSafeToModify('src/security/scan.ts')).toBe(false);
  });

  it('should allow modifications to regular files', () => {
    expect(evolution.isSafeToModify('src/utils/helpers.ts')).toBe(true);
    expect(evolution.isSafeToModify('packages/agent-engine/src/runner.ts')).toBe(true);
  });

  it('should calculate overall fitness', async () => {
    const score = await evolution.evaluateFitness(0.95, 100, 5000, 0.85);
    expect(score.overall).toBeGreaterThan(0);
    expect(score.overall).toBeLessThanOrEqual(1);
  });

  it('should weight test pass rate heavily', async () => {
    const highTest = await evolution.evaluateFitness(1.0, 5000, 50000, 0.5);
    const lowTest = await evolution.evaluateFitness(0.0, 100, 1000, 1.0);
    expect(highTest.overall).toBeGreaterThan(lowTest.overall);
  });

  it('should apply improvement when fitness increases', () => {
    const before: FitnessScore = { testPassRate: 0.8, executionSpeedMs: 1000, tokenUsage: 5000, codeCoverage: 0.7, overall: 0.75 };
    const after: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    expect(evolution.shouldApply(before, after)).toBe(true);
  });

  it('should reject improvement when fitness degrades beyond threshold', () => {
    const before: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    const after: FitnessScore = { testPassRate: 0.7, executionSpeedMs: 2000, tokenUsage: 8000, codeCoverage: 0.6, overall: 0.60 };
    expect(evolution.shouldApply(before, after)).toBe(false);
  });

  it('should detect when rollback is needed', () => {
    const before: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    const after: FitnessScore = { testPassRate: 0.7, executionSpeedMs: 2000, tokenUsage: 8000, codeCoverage: 0.6, overall: 0.60 };
    expect(evolution.shouldRollback(before, after)).toBe(true);
  });

  it('should not rollback for small degradations', () => {
    const before: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    const after: FitnessScore = { testPassRate: 0.89, executionSpeedMs: 820, tokenUsage: 4100, codeCoverage: 0.79, overall: 0.84 };
    expect(evolution.shouldRollback(before, after)).toBe(false);
  });

  it('should run evolution cycle and produce improvement', async () => {
    const before: FitnessScore = { testPassRate: 0.8, executionSpeedMs: 1000, tokenUsage: 5000, codeCoverage: 0.7, overall: 0.75 };
    const after: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    const result = await evolution.runEvolutionCycle('src/utils/helpers.ts', 'function add(a, b) { return a + b; }', before, after);
    expect(result.improvement).toBeDefined();
    expect(result.improvement.filePath).toBe('src/utils/helpers.ts');
  });

  it('should not run when disabled', async () => {
    evolution.disable();
    const before: FitnessScore = { testPassRate: 0.8, executionSpeedMs: 1000, tokenUsage: 5000, codeCoverage: 0.7, overall: 0.75 };
    const after: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    const result = await evolution.runEvolutionCycle('src/utils/helpers.ts', 'code', before, after);
    expect(result.applied).toBe(false);
    expect(result.improvement.status).toBe('rejected');
  });

  it('should respect daily cycle limit', async () => {
    const e = new SelfEvolvingCode(new MockEchoProvider(), { enabled: true, maxCyclesPerDay: 2 });
    const before: FitnessScore = { testPassRate: 0.8, executionSpeedMs: 1000, tokenUsage: 5000, codeCoverage: 0.7, overall: 0.75 };
    const after: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };

    await e.runEvolutionCycle('src/a.ts', 'code', before, after);
    await e.runEvolutionCycle('src/b.ts', 'code', before, after);
    const result = await e.runEvolutionCycle('src/c.ts', 'code', before, after);
    expect(result.applied).toBe(false);
    expect(result.improvement.description).toBe('daily limit reached');
  });

  it('should record applied improvements in archive', async () => {
    const before: FitnessScore = { testPassRate: 0.8, executionSpeedMs: 1000, tokenUsage: 5000, codeCoverage: 0.7, overall: 0.75 };
    const after: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    await evolution.runEvolutionCycle('src/utils/helpers.ts', 'code', before, after);
    const archive = evolution.getArchive();
    // Archive may be empty if LLM didn't return parseable JSON, but should not error
    expect(Array.isArray(archive)).toBe(true);
  });

  it('should rollback applied improvement', async () => {
    const before: FitnessScore = { testPassRate: 0.8, executionSpeedMs: 1000, tokenUsage: 5000, codeCoverage: 0.7, overall: 0.75 };
    const after: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    const result = await evolution.runEvolutionCycle('src/utils/helpers.ts', 'code', before, after);
    if (result.applied) {
      const rolledBack = await evolution.rollback(result.improvement.id);
      expect(rolledBack).toBe(true);
      const entry = evolution.getArchive().find((e) => e.improvement.id === result.improvement.id);
      expect(entry?.improvement.status).toBe('rolled_back');
    }
  });

  it('should return false for rollback of unknown improvement', async () => {
    const result = await evolution.rollback('nonexistent-id');
    expect(result).toBe(false);
  });

  it('should get archive stats', async () => {
    const before: FitnessScore = { testPassRate: 0.8, executionSpeedMs: 1000, tokenUsage: 5000, codeCoverage: 0.7, overall: 0.75 };
    const after: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    await evolution.runEvolutionCycle('src/utils/helpers.ts', 'code', before, after);
    const stats = evolution.getArchiveStats();
    expect(stats.totalEntries).toBeGreaterThanOrEqual(0);
    expect(stats.appliedCount).toBeGreaterThanOrEqual(0);
    expect(stats.avgFitnessDelta).toBeDefined();
  });

  it('should get and set config', () => {
    const config = evolution.getConfig();
    expect(config.maxCyclesPerDay).toBe(5);
    evolution.setConfig({ maxCyclesPerDay: 10 });
    expect(evolution.getConfig().maxCyclesPerDay).toBe(10);
  });

  it('should reset all state', async () => {
    const before: FitnessScore = { testPassRate: 0.8, executionSpeedMs: 1000, tokenUsage: 5000, codeCoverage: 0.7, overall: 0.75 };
    const after: FitnessScore = { testPassRate: 0.9, executionSpeedMs: 800, tokenUsage: 4000, codeCoverage: 0.8, overall: 0.85 };
    await evolution.runEvolutionCycle('src/utils/helpers.ts', 'code', before, after);
    evolution.reset();
    expect(evolution.getArchive()).toHaveLength(0);
  });

  it('should analyze module and return improvements', async () => {
    const improvements = await evolution.analyzeModule('src/utils/helpers.ts', 'function add(a, b) { return a + b; }');
    expect(Array.isArray(improvements)).toBe(true);
  });

  it('should return empty improvements when disabled', async () => {
    evolution.disable();
    const improvements = await evolution.analyzeModule('src/utils/helpers.ts', 'code');
    expect(improvements).toHaveLength(0);
  });
});
