import { describe, it, expect, beforeEach } from 'vitest';
import { ZeroDataCoEvolution } from './zero-data-co-evolution.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('ZeroDataCoEvolution', () => {
  let coevo: ZeroDataCoEvolution;

  beforeEach(() => {
    coevo = new ZeroDataCoEvolution(new MockEchoProvider());
  });

  it('should initialize with difficulty 1', () => {
    const state = coevo.getState();
    expect(state.currentDifficulty).toBe(1);
    expect(state.tasksGenerated).toBe(0);
  });

  it('should generate a task', async () => {
    const task = await coevo.generateTask();
    expect(task.id).toBeDefined();
    expect(task.description).toBeDefined();
    expect(task.difficulty).toBeGreaterThanOrEqual(1);
  });

  it('should execute a task successfully', async () => {
    const task = await coevo.generateTask();
    const result = await coevo.executeTask(task, async () => ({
      success: true,
      score: 85,
      approach: 'direct',
      lessons: ['learned something'],
    }));
    expect(result.success).toBe(true);
    expect(result.score).toBe(85);
  });

  it('should increase difficulty on success', async () => {
    const task = await coevo.generateTask();
    await coevo.executeTask(task, async () => ({ success: true, score: 90, approach: 'direct', lessons: [] }));
    expect(coevo.getState().currentDifficulty).toBeGreaterThan(1);
  });

  it('should decrease difficulty on failure', async () => {
    const task = await coevo.generateTask();
    await coevo.executeTask(task, async () => ({ success: true, score: 90, approach: 'direct', lessons: [] }));
    const before = coevo.getState().currentDifficulty;
    const task2 = await coevo.generateTask();
    await coevo.executeTask(task2, async () => ({ success: false, score: 20, approach: 'failed', lessons: [] }));
    expect(coevo.getState().currentDifficulty).toBeLessThan(before);
  });

  it('should run co-evolution cycle', async () => {
    const results = await coevo.runCoEvolutionCycle(async () => ({
      success: true,
      score: 70,
      approach: 'test',
      lessons: [],
    }), 3);
    expect(results).toHaveLength(3);
  });

  it('should track domains explored', async () => {
    await coevo.generateTask();
    expect(coevo.getState().domainsExplored.length).toBeGreaterThan(0);
  });

  it('should get stats', async () => {
    const task = await coevo.generateTask();
    await coevo.executeTask(task, async () => ({ success: true, score: 80, approach: 'direct', lessons: [] }));
    const stats = coevo.getStats();
    expect(stats.generated).toBe(1);
    expect(stats.solved).toBe(1);
    expect(stats.successRate).toBe(100);
  });

  it('should handle execution errors', async () => {
    const task = await coevo.generateTask();
    const result = await coevo.executeTask(task, async () => { throw new Error('fail'); });
    expect(result.success).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should reset', async () => {
    await coevo.generateTask();
    coevo.reset();
    expect(coevo.getState().tasksGenerated).toBe(0);
    expect(coevo.getTasks()).toHaveLength(0);
  });

  it('should cap difficulty at 10', async () => {
    for (let i = 0; i < 20; i++) {
      const task = await coevo.generateTask();
      await coevo.executeTask(task, async () => ({ success: true, score: 100, approach: 'direct', lessons: [] }));
    }
    expect(coevo.getState().currentDifficulty).toBeLessThanOrEqual(10);
  });
});
