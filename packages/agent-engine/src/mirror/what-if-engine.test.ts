import { describe, it, expect, beforeEach } from 'vitest';
import { WhatIfEngine } from './what-if-engine.js';
import { DigitalTwin } from './digital-twin.js';
import { EnvironmentGraph } from '../world-model/index.js';
import { MockLlmProvider } from '../mockLlmProvider.js';

describe('WhatIfEngine', () => {
  let engine: WhatIfEngine;
  let llm: MockLlmProvider;

  beforeEach(() => {
    llm = new MockLlmProvider();
    const graph = new EnvironmentGraph();
    const twin = new DigitalTwin(graph);
    engine = new WhatIfEngine(twin, llm);
  });

  it('should simulate an action and return scenarios', async () => {
    const result = await engine.simulate('execute_code', 'test.py');
    expect(result).toBeDefined();
    expect(result).toHaveProperty('scenarios');
    expect(result).toHaveProperty('recommendation');
    expect(result).toHaveProperty('tokensUsed');
    expect(Array.isArray(result.scenarios)).toBe(true);
  });

  it('should handle different action types', async () => {
    const result1 = await engine.simulate('read_file', 'config.json');
    const result2 = await engine.simulate('write_file', 'output.txt');
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1.scenarios.length).toBeGreaterThanOrEqual(0);
    expect(result2.scenarios.length).toBeGreaterThanOrEqual(0);
  });
});
