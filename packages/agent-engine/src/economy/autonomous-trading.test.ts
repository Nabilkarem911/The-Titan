import { describe, it, expect, beforeEach } from 'vitest';
import { RLEnvironment, RLState, RLAction } from './autonomous-trading.js';

describe('RLEnvironment', () => {
  let rl: RLEnvironment;

  beforeEach(() => {
    rl = new RLEnvironment(0.1, 0.95, 0.1);
  });

  it('should initialize', () => {
    expect(rl.getEpisodes()).toHaveLength(0);
    expect(rl.getQTableSize()).toBe(0);
  });

  it('should start and end an episode', () => {
    const state: RLState = { id: 's1', features: [0, 1], description: 'start', timestamp: new Date() };
    rl.startEpisode(state);
    const episode = rl.endEpisode(true);
    expect(episode).not.toBeNull();
    expect(episode!.success).toBe(true);
  });

  it('should select action with epsilon-greedy', () => {
    const state: RLState = { id: 's1', features: [0, 1], description: 'start', timestamp: new Date() };
    const actions: RLAction[] = [
      { id: 'a1', name: 'buy', expectedReward: 1 },
      { id: 'a2', name: 'sell', expectedReward: 0.5 },
    ];
    const selected = rl.selectAction(state, actions);
    expect(selected).toBeDefined();
  });

  it('should record steps and update Q-table', () => {
    const state: RLState = { id: 's1', features: [0, 1], description: 'start', timestamp: new Date() };
    const nextState: RLState = { id: 's2', features: [1, 0], description: 'next', timestamp: new Date() };
    const action: RLAction = { id: 'a1', name: 'buy', expectedReward: 1 };

    rl.startEpisode(state);
    rl.recordStep(state, action, 10, nextState);
    rl.endEpisode(true);

    expect(rl.getQTableSize()).toBeGreaterThan(0);
  });

  it('should train with multiple episodes', () => {
    const result = rl.train(
      () => ({ id: 's', features: [Math.random()], description: 'state', timestamp: new Date() }),
      () => [
        { id: 'a1', name: 'action1', expectedReward: 1 },
        { id: 'a2', name: 'action2', expectedReward: 0.5 },
      ],
      (_s, _a, _n) => Math.random(),
      (_s, steps) => steps >= 5,
      10,
    );

    expect(result.episodes).toBe(10);
    expect(result.avgReward).toBeGreaterThan(0);
  });

  it('should get stats', () => {
    rl.train(
      () => ({ id: 's', features: [0.5], description: 'state', timestamp: new Date() }),
      () => [{ id: 'a', name: 'act', expectedReward: 1 }],
      () => 1,
      (_s, steps) => steps >= 3,
      5,
    );
    const stats = rl.getStats();
    expect(stats.totalEpisodes).toBe(5);
    expect(stats.avgReward).toBeGreaterThan(0);
  });

  it('should reset', () => {
    rl.train(
      () => ({ id: 's', features: [0.5], description: 'state', timestamp: new Date() }),
      () => [{ id: 'a', name: 'act', expectedReward: 1 }],
      () => 1,
      (_s, steps) => steps >= 1,
      3,
    );
    rl.reset();
    expect(rl.getEpisodes()).toHaveLength(0);
    expect(rl.getQTableSize()).toBe(0);
  });
});
