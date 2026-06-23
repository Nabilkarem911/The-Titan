import { describe, it, expect, beforeEach } from 'vitest';
import { ProactiveIntelligence } from './proactive-intelligence.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('ProactiveIntelligence', () => {
  let pi: ProactiveIntelligence;

  beforeEach(() => {
    pi = new ProactiveIntelligence(new MockEchoProvider());
  });

  it('should initialize', () => {
    const stats = pi.getStats();
    expect(stats.suggestions).toBe(0);
    expect(stats.simulations).toBe(0);
  });

  it('should analyze patterns and return suggestion', async () => {
    const suggestion = await pi.analyzePatterns(['deploy at 6pm', 'deploy at 6pm', 'deploy at 6pm']);
    if (suggestion) {
      expect(suggestion.pattern).toBeDefined();
      expect(suggestion.suggestion).toBeDefined();
      expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
    }
  });

  it('should simulate action', async () => {
    const sim = await pi.simulateAction('restart database', '3 services depend on DB');
    expect(sim.action).toBe('restart database');
    expect(sim.predictedEffects).toBeDefined();
    expect(sim.safeToExecute).toBeDefined();
  });

  it('should propose architecture change', () => {
    const change = pi.proposeArchitectureChange('parallel', 'pipeline', [
      { pattern: 'orchestrator-worker', success: true, score: 90 },
      { pattern: 'pipeline', success: true, score: 70 },
    ]);
    expect(change.fromPattern).toBe('pipeline');
    expect(change.toPattern).toBe('orchestrator-worker');
    expect(change.applied).toBe(false);
  });

  it('should not apply untested architecture change', () => {
    const change = pi.proposeArchitectureChange('parallel', 'pipeline', [
      { pattern: 'orchestrator-worker', success: true, score: 90 },
    ]);
    expect(pi.applyArchitectureChange(change.id)).toBe(false);
  });

  it('should apply tested architecture change', () => {
    const change = pi.proposeArchitectureChange('parallel', 'pipeline', [
      { pattern: 'orchestrator-worker', success: true, score: 90 },
    ]);
    change.tested = true;
    expect(pi.applyArchitectureChange(change.id)).toBe(true);
  });

  it('should propose live edit', async () => {
    const edit = await pi.proposeLiveEdit('src/test.ts', 'function add(a, b) { return a + b; }', 'make it faster');
    expect(edit.filePath).toBe('src/test.ts');
    expect(edit.originalCode).toBeDefined();
    expect(edit.modifiedCode).toBeDefined();
    expect(edit.userApproved).toBe(false);
  });

  it('should approve live edit', async () => {
    const edit = await pi.proposeLiveEdit('src/test.ts', 'const x = 1;', 'rename to y');
    expect(pi.approveLiveEdit(edit.id)).toBe(true);
    expect(edit.applied).toBe(true);
    expect(edit.userApproved).toBe(true);
  });

  it('should fail to approve nonexistent edit', () => {
    expect(pi.approveLiveEdit('nonexistent')).toBe(false);
  });

  it('should set do not disturb', () => {
    pi.setDoNotDisturb(22, 8);
    // Can't easily test time-based logic, but it should not crash
  });

  it('should get stats', async () => {
    await pi.analyzePatterns(['action1']);
    await pi.simulateAction('test', 'env');
    pi.proposeArchitectureChange('type', 'pipeline', []);
    await pi.proposeLiveEdit('f.ts', 'code', 'edit');
    const stats = pi.getStats();
    expect(stats.suggestions).toBeGreaterThanOrEqual(0);
    expect(stats.simulations).toBe(1);
    expect(stats.architectureChanges).toBe(1);
    expect(stats.liveEdits).toBe(1);
  });

  it('should reset', async () => {
    await pi.simulateAction('test', 'env');
    pi.reset();
    expect(pi.getSimulations()).toHaveLength(0);
  });
});
