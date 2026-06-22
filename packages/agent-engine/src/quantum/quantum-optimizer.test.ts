import { describe, it, expect, beforeEach } from 'vitest';
import { QuantumOptimizer } from './quantum-optimizer.js';

describe('QuantumOptimizer', () => {
  let q: QuantumOptimizer;

  beforeEach(() => {
    q = new QuantumOptimizer();
  });

  it('should initialize with bounded tensor rank and bond dimension', () => {
    expect(q.getTensorRank()).toBeLessThanOrEqual(32);
    expect(q.getBondDimension()).toBeLessThanOrEqual(64);
  });

  it('should superpose strategies and collapse to best', async () => {
    const state = await q.superposeStrategies(['A', 'B', 'C'], (s) => s === 'B' ? 10 : 1);
    expect(state.collapsed).toBe('B');
    expect(state.strategies).toHaveLength(3);
  });

  it('should complete collapse within 5s', async () => {
    const state = await q.superposeStrategies(['A', 'B'], (s) => 1);
    expect(state.collapseTimeMs).toBeLessThan(5000);
  });

  it('should optimize and return result', async () => {
    const result = await q.optimize('test', ['A', 'B', 'C'], (s) => s === 'C' ? 100 : 1);
    expect(result.optimalStrategy).toBe('C');
    expect(result.alternatives.length).toBe(2);
  });

  it('should allocate tasks to agents', () => {
    const agents = [{ id: 'a1', capability: 10 }, { id: 'a2', capability: 5 }];
    const tasks = [{ id: 't1', difficulty: 5, requiredCapability: 8 }, { id: 't2', difficulty: 2, requiredCapability: 3 }];
    const assignments = q.optimizeTaskAllocation(agents, tasks);
    expect(assignments).toHaveLength(2);
    expect(assignments[0].agentId).toBe('a1'); // best agent gets hardest task
  });

  it('should entangle memories with shared tags', () => {
    const memories = [
      { id: 'm1', domain: 'coding', content: 'x', tags: ['bug', 'fix'] },
      { id: 'm2', domain: 'debugging', content: 'y', tags: ['bug', 'trace'] },
      { id: 'm3', domain: 'music', content: 'z', tags: ['art'] },
    ];
    const entanglements = q.entangleMemories(memories);
    expect(entanglements.length).toBeGreaterThan(0);
    expect(entanglements.some((e) => e.memoryA === 'm1' && e.memoryB === 'm2')).toBe(true);
  });

  it('should not entangle memories with no shared tags', () => {
    const memories = [
      { id: 'm1', domain: 'a', content: 'x', tags: ['tag1'] },
      { id: 'm2', domain: 'b', content: 'y', tags: ['tag2'] },
    ];
    const entanglements = q.entangleMemories(memories);
    expect(entanglements).toHaveLength(0);
  });

  it('should compute tensor network contraction', () => {
    const result = q.tensorNetworkCompute([1, 2, 3], [4, 5, 6]);
    expect(result).toBeGreaterThan(0);
  });

  it('should fall back to greedy for >100 agents', () => {
    const agents = Array.from({ length: 101 }, (_, i) => ({ id: `a${i}`, capability: i }));
    const tasks = [{ id: 't1', difficulty: 1, requiredCapability: 1 }];
    const assignments = q.optimizeTaskAllocation(agents, tasks);
    expect(assignments).toHaveLength(1);
  });
});
