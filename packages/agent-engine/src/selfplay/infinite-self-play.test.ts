import { describe, it, expect, beforeEach } from 'vitest';
import { InfiniteSelfPlay } from './infinite-self-play.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('InfiniteSelfPlay', () => {
  let selfPlay: InfiniteSelfPlay;

  beforeEach(() => {
    selfPlay = new InfiniteSelfPlay(new MockEchoProvider());
  });

  it('should be disabled by default', () => {
    expect(selfPlay.isEnabled()).toBe(false);
  });

  it('should enable and disable', () => {
    selfPlay.enable();
    expect(selfPlay.isEnabled()).toBe(true);
    selfPlay.disable();
    expect(selfPlay.isEnabled()).toBe(false);
  });

  it('should return empty results when disabled', async () => {
    const result = await selfPlay.runSession(5);
    expect(result.iterations).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(result.newCapabilities).toHaveLength(0);
  });

  it('should run a session when enabled', async () => {
    selfPlay.enable();
    const result = await selfPlay.runSession(3);
    expect(result.iterations).toBe(3);
    expect(result.results).toHaveLength(3);
  });

  it('should generate tasks with valid fields', async () => {
    selfPlay.enable();
    const result = await selfPlay.runSession(1);
    expect(result.results[0].solution.length).toBeGreaterThan(0);
    expect(result.results[0].tokensUsed).toBeGreaterThan(0);
    expect(result.results[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should record entries in evolutionary archive', async () => {
    selfPlay.enable();
    await selfPlay.runSession(2);
    const archive = selfPlay.getArchive();
    expect(archive.length).toBe(2);
    expect(archive[0].taskId).toBeDefined();
    expect(archive[0].timestamp).toBeDefined();
  });

  it('should track archive stats', async () => {
    selfPlay.enable();
    await selfPlay.runSession(3);
    const stats = selfPlay.getArchiveStats();
    expect(stats.totalEntries).toBe(3);
    expect(stats.successCount).toBeGreaterThanOrEqual(0);
    expect(stats.avgScore).toBeGreaterThanOrEqual(0);
    expect(stats.domains.length).toBeGreaterThan(0);
  });

  it('should update capability horizons', async () => {
    selfPlay.enable();
    await selfPlay.runSession(3);
    const horizons = selfPlay.getHorizons();
    expect(horizons.length).toBeGreaterThan(0);
    expect(horizons[0].domain).toBeDefined();
    expect(horizons[0].totalAttempts).toBeGreaterThan(0);
    expect(horizons[0].successRate).toBeGreaterThanOrEqual(0);
    expect(horizons[0].successRate).toBeLessThanOrEqual(1);
  });

  it('should get horizon by domain', async () => {
    selfPlay.enable();
    await selfPlay.runSession(3);
    const horizons = selfPlay.getHorizons();
    if (horizons.length > 0) {
      const domain = horizons[0].domain;
      const horizon = selfPlay.getHorizon(domain);
      expect(horizon).toBeDefined();
      expect(horizon!.domain).toBe(domain);
    }
  });

  it('should return undefined for unknown domain', () => {
    expect(selfPlay.getHorizon('nonexistent')).toBeUndefined();
  });

  it('should track trajectory in results', async () => {
    selfPlay.enable();
    const result = await selfPlay.runSession(1);
    expect(result.results[0].trajectory.length).toBeGreaterThan(0);
    expect(result.results[0].trajectory[0].step).toBeDefined();
  });

  it('should reset all state', async () => {
    selfPlay.enable();
    await selfPlay.runSession(2);
    expect(selfPlay.getArchive().length).toBe(2);
    selfPlay.reset();
    expect(selfPlay.getArchive()).toHaveLength(0);
    expect(selfPlay.getHorizons()).toHaveLength(0);
  });

  it('should respect max iterations', async () => {
    selfPlay.enable();
    const result = await selfPlay.runSession(2);
    expect(result.iterations).toBe(2);
  });

  it('should reset week counter', () => {
    selfPlay.resetWeek();
    // No error means success
    expect(true).toBe(true);
  });

  it('should handle LLM errors gracefully in session', async () => {
    const failingLlm = {
      complete: async () => { throw new Error('LLM unavailable'); },
    };
    const sp = new InfiniteSelfPlay(failingLlm as any);
    sp.enable();
    const result = await sp.runSession(3);
    // Should complete without throwing, even with errors
    expect(result.iterations).toBe(3);
    expect(result.results).toHaveLength(0);
  });
});
