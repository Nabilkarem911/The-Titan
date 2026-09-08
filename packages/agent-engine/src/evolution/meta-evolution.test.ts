import { describe, it, expect, beforeEach } from 'vitest';
import { MetaEvolution } from './meta-evolution.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('MetaEvolution', () => {
  let meta: MetaEvolution;

  beforeEach(() => {
    meta = new MetaEvolution(new MockEchoProvider());
  });

  it('should initialize with a default improvement prompt', () => {
    expect(meta.getImprovementPrompt()).toBeDefined();
    expect(meta.getImprovementPrompt().length).toBeGreaterThan(0);
  });

  it('should self-modify prompt and return an evolution entry', async () => {
    const entry = await meta.selfModifyPrompt({ successRate: 70, avgScore: 65 });
    expect(entry.promptBefore).toBeDefined();
    expect(entry.promptAfter).toBeDefined();
    expect(entry.domain).toBe('meta-prompt');
  });

  it('should record evolution in archive', async () => {
    await meta.selfModifyPrompt({ successRate: 70, avgScore: 65 });
    expect(meta.getArchive()).toHaveLength(1);
  });

  it('should run A/B tests', async () => {
    const result = await meta.abTest('variant A', 'variant B', (v) => v.includes('B') ? 80 : 60, 5);
    expect(result.scoresA).toHaveLength(5);
    expect(result.scoresB).toHaveLength(5);
    expect(result.winner).toBe('B');
  });

  it('should detect tie in A/B test', async () => {
    const result = await meta.abTest('same', 'same', () => 50, 3);
    expect(result.winner).toBe('tie');
  });

  it('should perform cross-domain transfer', async () => {
    const transfer = await meta.crossDomainTransfer('coding', 'debugging', 'break down complex problems');
    expect(transfer.sourceDomain).toBe('coding');
    expect(transfer.targetDomain).toBe('debugging');
    expect(transfer.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should rollback last evolution', async () => {
    await meta.selfModifyPrompt({ successRate: 70, avgScore: 65 });
    const rolledBack = meta.rollbackLastEvolution();
    if (rolledBack) {
      expect(rolledBack.rolledBack).toBe(true);
    }
  });

  it('should return null rollback when no applied evolution', () => {
    expect(meta.rollbackLastEvolution()).toBeNull();
  });

  it('should get stats', async () => {
    await meta.selfModifyPrompt({ successRate: 70, avgScore: 65 });
    await meta.abTest('a', 'b', () => 50, 3);
    await meta.crossDomainTransfer('x', 'y', 'pattern');
    const stats = meta.getStats();
    expect(stats.totalEvolutions).toBe(1);
    expect(stats.abTests).toBe(1);
    expect(stats.transfers).toBe(1);
  });

  it('should reset', async () => {
    await meta.selfModifyPrompt({ successRate: 70, avgScore: 65 });
    meta.reset();
    expect(meta.getArchive()).toHaveLength(0);
  });
});
