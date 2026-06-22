import { describe, it, expect, beforeEach } from 'vitest';
import { EpisodicBuffer } from './episodic-buffer.js';
import { InnerMonologueManager } from './inner-monologue.js';
import { CognitiveController } from './cognitive-controller.js';
import { MirrorConsciousness } from './orchestrator.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('EpisodicBuffer', () => {
  let buffer: EpisodicBuffer;

  beforeEach(() => {
    buffer = new EpisodicBuffer(7);
  });

  it('should add items up to capacity', () => {
    for (let i = 0; i < 5; i++) {
      buffer.add({ content: `item ${i}`, type: 'thought', salience: 0.5 });
    }
    expect(buffer.getSize()).toBe(5);
    expect(buffer.isFull()).toBe(false);
  });

  it('should remove lowest salience items when over capacity', () => {
    for (let i = 0; i < 10; i++) {
      buffer.add({ content: `item ${i}`, type: 'thought', salience: i * 0.1 });
    }
    expect(buffer.getSize()).toBe(7);
    // Lowest salience items should have been removed
    const items = buffer.getItems();
    expect(items[0].salience).toBeGreaterThanOrEqual(0.3);
  });

  it('should sort items by salience', () => {
    buffer.add({ content: 'low', type: 'thought', salience: 0.1 });
    buffer.add({ content: 'high', type: 'thought', salience: 0.9 });
    buffer.add({ content: 'mid', type: 'thought', salience: 0.5 });
    const items = buffer.getItems();
    expect(items[0].content).toBe('high');
    expect(items[1].content).toBe('mid');
    expect(items[2].content).toBe('low');
  });

  it('should decay salience over time', () => {
    buffer.add({ content: 'test', type: 'thought', salience: 0.8 });
    buffer.decaySalience(0.5);
    const items = buffer.getItems();
    expect(items[0].salience).toBeCloseTo(0.4);
  });

  it('should remove items with very low salience after decay', () => {
    buffer.add({ content: 'fade', type: 'thought', salience: 0.15 });
    buffer.decaySalience(0.5);
    expect(buffer.getSize()).toBe(0);
  });

  it('should generate context string', () => {
    buffer.add({ content: 'hello', type: 'perception', salience: 0.5 });
    const ctx = buffer.toContextString();
    expect(ctx).toContain('hello');
    expect(ctx).toContain('[perception]');
  });

  it('should return empty context for empty buffer', () => {
    expect(buffer.toContextString()).toBe('[empty consciousness]');
  });

  it('should get most salient item', () => {
    buffer.add({ content: 'low', type: 'thought', salience: 0.1 });
    buffer.add({ content: 'high', type: 'thought', salience: 0.9 });
    const top = buffer.getMostSalient();
    expect(top?.content).toBe('high');
  });

  it('should return null for most salient when empty', () => {
    expect(buffer.getMostSalient()).toBeNull();
  });

  it('should clear all items', () => {
    buffer.add({ content: 'test', type: 'thought', salience: 0.5 });
    buffer.clear();
    expect(buffer.getSize()).toBe(0);
  });

  it('should enforce min capacity of 5', () => {
    const small = new EpisodicBuffer(2);
    expect(small.getCapacity()).toBe(5);
  });

  it('should enforce max capacity of 9', () => {
    const large = new EpisodicBuffer(20);
    expect(large.getCapacity()).toBe(9);
  });
});

describe('InnerMonologueManager', () => {
  let manager: InnerMonologueManager;

  beforeEach(() => {
    manager = new InnerMonologueManager(5);
  });

  it('should add threads', () => {
    const id = manager.addThread('goals', 'test goal', 1);
    expect(manager.getThreadCount()).toBe(1);
    expect(manager.getActiveThreads()[0].type).toBe('goals');
  });

  it('should remove lowest priority thread when at max', () => {
    manager.addThread('goals', 'high', 5);
    manager.addThread('reasoning', 'mid', 3);
    manager.addThread('memory', 'low', 1);
    manager.addThread('emotional', 'mid2', 3);
    manager.addThread('monitoring', 'low2', 1);
    manager.addThread('goals', 'new', 10);
    expect(manager.getThreadCount()).toBe(5);
  });

  it('should sort threads by priority', () => {
    manager.addThread('goals', 'low', 1);
    manager.addThread('reasoning', 'high', 5);
    manager.addThread('memory', 'mid', 3);
    const threads = manager.getActiveThreads();
    expect(threads[0].content).toBe('high');
    expect(threads[1].content).toBe('mid');
    expect(threads[2].content).toBe('low');
  });

  it('should update thread content', () => {
    const id = manager.addThread('goals', 'original', 1);
    manager.updateThread(id, 'updated');
    expect(manager.getActiveThreads()[0].content).toBe('updated');
  });

  it('should remove threads', () => {
    const id = manager.addThread('goals', 'test', 1);
    manager.removeThread(id);
    expect(manager.getThreadCount()).toBe(0);
  });

  it('should clear all threads', () => {
    manager.addThread('goals', 'test1', 1);
    manager.addThread('reasoning', 'test2', 2);
    manager.clear();
    expect(manager.getThreadCount()).toBe(0);
  });

  it('should run all threads with mock LLM', async () => {
    const mock = new MockEchoProvider();
    const results = await manager.runAllThreads(mock, 'test context');
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.output.length > 0)).toBe(true);
  });

  it('should handle LLM errors gracefully', async () => {
    const failingMock = {
      complete: async () => { throw new Error('LLM unavailable'); },
    };
    const results = await manager.runAllThreads(failingMock as any, 'test');
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.output === '[thread unavailable]')).toBe(true);
  });
});

describe('CognitiveController', () => {
  it('should synthesize narrative from threads', async () => {
    const mock = new MockEchoProvider();
    const controller = new CognitiveController();
    const threadResults = [
      { threadId: 'goals', type: 'goals' as const, output: 'Trying to help the user', tokensUsed: 50 },
      { threadId: 'reasoning', type: 'reasoning' as const, output: 'Using deductive logic', tokensUsed: 40 },
    ];
    const result = await controller.synthesize(mock, threadResults, 'test context');
    expect(result.narrative.length).toBeGreaterThan(0);
    expect(result.selfModel.identity).toBeDefined();
    expect(result.selfModel.currentGoal).toBeDefined();
    expect(result.selfModel.confidenceLevel).toBeGreaterThanOrEqual(0);
    expect(result.selfModel.confidenceLevel).toBeLessThanOrEqual(1);
  });

  it('should store narrative history', async () => {
    const mock = new MockEchoProvider();
    const controller = new CognitiveController(5);
    const threads = [
      { threadId: 'goals', type: 'goals' as const, output: 'test', tokensUsed: 10 },
    ];
    await controller.synthesize(mock, threads, 'context 1');
    await controller.synthesize(mock, threads, 'context 2');
    const history = controller.getNarrativeHistory();
    expect(history.length).toBe(2);
  });

  it('should limit history size', async () => {
    const mock = new MockEchoProvider();
    const controller = new CognitiveController(3);
    const threads = [
      { threadId: 'goals', type: 'goals' as const, output: 'test', tokensUsed: 10 },
    ];
    for (let i = 0; i < 5; i++) {
      await controller.synthesize(mock, threads, `context ${i}`);
    }
    expect(controller.getNarrativeHistory().length).toBe(3);
  });

  it('should handle malformed LLM response', async () => {
    const badMock = {
      complete: async () => ({
        content: 'not json at all',
        tokensUsed: 10,
        finishReason: 'stop' as const,
      }),
    };
    const controller = new CognitiveController();
    const threads = [
      { threadId: 'goals', type: 'goals' as const, output: 'test', tokensUsed: 10 },
    ];
    const result = await controller.synthesize(badMock as any, threads, 'context');
    expect(result.narrative).toBe('not json at all');
    expect(result.selfModel.identity).toBe('Titan');
  });
});

describe('MirrorConsciousness', () => {
  it('should be disabled by default', () => {
    const mirror = new MirrorConsciousness();
    expect(mirror.isEnabled()).toBe(false);
  });

  it('should be enabled via config', () => {
    const mirror = new MirrorConsciousness({ enabled: true });
    expect(mirror.isEnabled()).toBe(true);
  });

  it('should return null when disabled', async () => {
    const mirror = new MirrorConsciousness({ enabled: false });
    const mock = new MockEchoProvider();
    const result = await mirror.processTurn(mock, 'context');
    expect(result).toBeNull();
  });

  it('should process a turn when enabled', async () => {
    const mirror = new MirrorConsciousness({ enabled: true });
    const mock = new MockEchoProvider();
    const result = await mirror.processTurn(mock, 'context', 'user message');
    expect(result).not.toBeNull();
    expect(result!.narrative.length).toBeGreaterThan(0);
    expect(result!.selfModel).toBeDefined();
    expect(result!.episodicBuffer.length).toBeGreaterThan(0);
    expect(result!.threadCount).toBe(5);
    expect(result!.tokensUsed).toBeGreaterThan(0);
  });

  it('should increment turn count', async () => {
    const mirror = new MirrorConsciousness({ enabled: true });
    const mock = new MockEchoProvider();
    expect(mirror.getTurnCount()).toBe(0);
    await mirror.processTurn(mock, 'context');
    expect(mirror.getTurnCount()).toBe(1);
    await mirror.processTurn(mock, 'context');
    expect(mirror.getTurnCount()).toBe(2);
  });

  it('should reset state', async () => {
    const mirror = new MirrorConsciousness({ enabled: true });
    const mock = new MockEchoProvider();
    await mirror.processTurn(mock, 'context');
    expect(mirror.getTurnCount()).toBe(1);
    mirror.reset();
    expect(mirror.getTurnCount()).toBe(0);
    expect(mirror.getEpisodicBuffer().getSize()).toBe(0);
  });

  it('should enable/disable dynamically', () => {
    const mirror = new MirrorConsciousness({ enabled: false });
    expect(mirror.isEnabled()).toBe(false);
    mirror.enable();
    expect(mirror.isEnabled()).toBe(true);
    mirror.disable();
    expect(mirror.isEnabled()).toBe(false);
  });

  it('should get current state after processing', async () => {
    const mirror = new MirrorConsciousness({ enabled: true });
    const mock = new MockEchoProvider();
    await mirror.processTurn(mock, 'context');
    const state = mirror.getCurrentState();
    expect(state).not.toBeNull();
    expect(state!.narrative.length).toBeGreaterThan(0);
  });

  it('should return null current state before any turn', () => {
    const mirror = new MirrorConsciousness({ enabled: true });
    expect(mirror.getCurrentState()).toBeNull();
  });
});
