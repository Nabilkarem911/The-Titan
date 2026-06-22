import { describe, it, expect, beforeEach } from 'vitest';
import { DreamWorld } from './dream-world.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('DreamWorld', () => {
  let dream: DreamWorld;

  beforeEach(() => {
    dream = new DreamWorld(new MockEchoProvider(), 5000);
  });

  it('should be idle by default', () => {
    expect(dream.isIdle()).toBe(true);
  });

  it('should dream and return a cycle', async () => {
    const cycle = await dream.dream(['fixed a bug', 'wrote tests']);
    expect(cycle.id).toBeDefined();
    expect(cycle.startTime).toBeDefined();
    expect(cycle.endTime).not.toBeNull();
    expect(cycle.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should record cycles', async () => {
    await dream.dream(['exp1']);
    await dream.dream(['exp2']);
    expect(dream.getCycles()).toHaveLength(2);
  });

  it('should get last cycle', async () => {
    await dream.dream(['exp1']);
    const last = dream.getLastCycle();
    expect(last).not.toBeNull();
  });

  it('should return null last cycle when none exist', () => {
    expect(dream.getLastCycle()).toBeNull();
  });

  it('should propagate insights', async () => {
    const cycle = await dream.dream(['exp1']);
    dream.propagateInsights(cycle);
    expect(cycle.insightPropagated).toBe(true);
  });

  it('should get stats', async () => {
    await dream.dream(['exp1']);
    const stats = dream.getStats();
    expect(stats.totalCycles).toBe(1);
  });

  it('should reset', async () => {
    await dream.dream(['exp1']);
    dream.reset();
    expect(dream.getCycles()).toHaveLength(0);
  });
});
