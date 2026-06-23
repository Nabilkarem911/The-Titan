import { describe, it, expect, beforeEach } from 'vitest';
import { InnerMonologueManager } from './inner-monologue.js';

describe('InnerMonologueManager', () => {
  let manager: InnerMonologueManager;

  beforeEach(() => {
    manager = new InnerMonologueManager();
  });

  it('should add a thread and return its id', () => {
    const id = manager.addThread('reasoning', 'Analyzing the problem');
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('should retrieve active threads', () => {
    manager.addThread('goals', 'Complete the task');
    manager.addThread('reasoning', 'Step by step analysis');
    const threads = manager.getActiveThreads();
    expect(threads.length).toBe(2);
  });

  it('should track thread count', () => {
    manager.addThread('memory', 'Remember this fact');
    manager.addThread('emotional', 'Feeling confident');
    expect(manager.getThreadCount()).toBe(2);
  });

  it('should update thread content', () => {
    const id = manager.addThread('reasoning', 'Initial thought');
    manager.updateThread(id, 'Updated thought');
    const threads = manager.getActiveThreads();
    const updated = threads.find((t) => t.id === id);
    expect(updated?.content).toBe('Updated thought');
  });

  it('should remove a thread', () => {
    const id = manager.addThread('monitoring', 'Watching for errors');
    manager.removeThread(id);
    expect(manager.getThreadCount()).toBe(0);
  });

  it('should clear all threads', () => {
    manager.addThread('goals', 'Goal 1');
    manager.addThread('reasoning', 'Reason 1');
    manager.clear();
    expect(manager.getThreadCount()).toBe(0);
  });

  it('should accept all thread types', () => {
    const types = ['goals', 'reasoning', 'memory', 'emotional', 'monitoring'] as const;
    for (const type of types) {
      manager.addThread(type, `Content for ${type}`);
    }
    expect(manager.getThreadCount()).toBe(5);
  });
});
