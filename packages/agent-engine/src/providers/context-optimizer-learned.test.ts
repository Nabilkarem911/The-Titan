import { describe, it, expect, beforeEach } from 'vitest';
import { ContextOptimizer, type ContextItem } from './context-optimizer.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('Learned Context Compression', () => {
  let optimizer: ContextOptimizer;

  beforeEach(() => {
    optimizer = new ContextOptimizer({
      maxContextTokens: 1000,
      enableLearnedCompression: true,
    });
  });

  it('should get default budget', () => {
    const budget = optimizer.getBudget();
    expect(budget.code).toBe(40);
    expect(budget.history).toBe(30);
    expect(budget.tools).toBe(20);
    expect(budget.reserve).toBe(10);
  });

  it('should set custom budget', () => {
    optimizer.setBudget({ code: 50, history: 25, tools: 15, reserve: 10 });
    const budget = optimizer.getBudget();
    expect(budget.code).toBe(50);
    expect(budget.history).toBe(25);
  });

  it('should normalize budget that does not sum to 100', () => {
    optimizer.setBudget({ code: 60, history: 30, tools: 20, reserve: 10 });
    const budget = optimizer.getBudget();
    const total = budget.code + budget.history + budget.tools + budget.reserve;
    expect(total).toBeCloseTo(100, 0);
  });

  it('should calculate budget allocation', () => {
    const allocation = optimizer.calculateBudgetAllocation(10000);
    expect(allocation.code).toBe(4000);
    expect(allocation.history).toBe(3000);
    expect(allocation.tools).toBe(2000);
    expect(allocation.reserve).toBe(1000);
  });

  it('should build context items from messages and tools', () => {
    const items = optimizer.buildContextItems(
      [
        { role: 'system', content: 'You are Titan' },
        { role: 'user', content: 'Hello world' },
      ],
      [{ name: 'execute_bash', description: 'Execute bash', parameters: { type: 'object' as const, properties: {} } }],
      [],
    );
    expect(items.length).toBe(3);
    expect(items[0].type).toBe('system');
    expect(items[1].type).toBe('history');
    expect(items[2].type).toBe('tool');
  });

  it('should compress context within budget', async () => {
    const items: ContextItem[] = [
      { id: '1', type: 'code', content: 'const x = 1', tokenEstimate: 100 },
      { id: '2', type: 'code', content: 'const y = 2', tokenEstimate: 100 },
      { id: '3', type: 'history', content: 'User asked about code', tokenEstimate: 50 },
      { id: '4', type: 'tool', content: 'execute_bash', tokenEstimate: 50 },
    ];
    const result = await optimizer.compressContext(new MockEchoProvider(), items, 'test task');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.tokensUsed).toBeLessThanOrEqual(1000);
    expect(result.tokensSaved).toBeGreaterThanOrEqual(0);
    expect(result.budgetAllocation).toBeDefined();
  });

  it('should respect budget per type', async () => {
    const items: ContextItem[] = [];
    // 20 code items at 100 tokens each = 2000 tokens, but code budget is only 400
    for (let i = 0; i < 20; i++) {
      items.push({ id: `code-${i}`, type: 'code', content: `code ${i}`, tokenEstimate: 100 });
    }
    const result = await optimizer.compressContext(new MockEchoProvider(), items, 'test');
    const codeItems = result.items.filter((i) => i.type === 'code');
    const codeTokens = codeItems.reduce((s, i) => s + i.tokenEstimate, 0);
    expect(codeTokens).toBeLessThanOrEqual(400);
  });

  it('should score items with LLM when learned compression enabled', async () => {
    const items: ContextItem[] = [
      { id: 'a', type: 'code', content: 'important code', tokenEstimate: 50 },
      { id: 'b', type: 'history', content: 'old message', tokenEstimate: 50 },
    ];
    const scored = await optimizer.scoreContextItems(new MockEchoProvider(), items, 'task');
    expect(scored.length).toBe(2);
    expect(scored[0].relevanceScore).toBeDefined();
    expect(scored[1].relevanceScore).toBeDefined();
  });

  it('should handle LLM errors in scoring gracefully', async () => {
    const failingLlm = {
      complete: async () => { throw new Error('LLM unavailable'); },
    };
    const items: ContextItem[] = [
      { id: 'a', type: 'code', content: 'test', tokenEstimate: 50 },
    ];
    const scored = await optimizer.scoreContextItems(failingLlm as any, items, 'task');
    expect(scored[0].relevanceScore).toBe(0.5);
  });

  it('should return empty array for empty items in scoring', async () => {
    const scored = await optimizer.scoreContextItems(new MockEchoProvider(), [], 'task');
    expect(scored).toHaveLength(0);
  });

  it('should work with learned compression disabled (default scores)', async () => {
    const opt = new ContextOptimizer({ maxContextTokens: 500, enableLearnedCompression: false });
    const items: ContextItem[] = [
      { id: '1', type: 'code', content: 'test', tokenEstimate: 100 },
      { id: '2', type: 'history', content: 'test2', tokenEstimate: 100 },
    ];
    const result = await opt.compressContext(new MockEchoProvider(), items, 'task');
    expect(result.items.length).toBeGreaterThan(0);
    // All items should have default score 0.5
    expect(result.items.every((i) => i.relevanceScore === 0.5)).toBe(true);
  });

  it('should sort items by relevance score within type', async () => {
    const items: ContextItem[] = [
      { id: 'low', type: 'code', content: 'less relevant', tokenEstimate: 50, relevanceScore: 0.2 },
      { id: 'high', type: 'code', content: 'very relevant', tokenEstimate: 50, relevanceScore: 0.9 },
      { id: 'mid', type: 'code', content: 'somewhat relevant', tokenEstimate: 50, relevanceScore: 0.5 },
    ];
    // Use enough budget for all code items (50*3=150 tokens, code budget needs >= 150)
    const opt = new ContextOptimizer({ maxContextTokens: 1000, enableLearnedCompression: false });
    const result = await opt.compressContext(new MockEchoProvider(), items, 'task');
    // All 3 items fit in code budget (400 tokens), so all kept
    expect(result.items.length).toBe(3);
    // Higher relevance items should come first
    const ids = result.items.map((i) => i.id);
    expect(ids.indexOf('high')).toBeLessThan(ids.indexOf('mid'));
    expect(ids.indexOf('mid')).toBeLessThan(ids.indexOf('low'));
  });

  it('should handle parseScores with invalid JSON', () => {
    const opt = new ContextOptimizer();
    // Access private method via any cast for testing
    const parse = (opt as any).parseScores.bind(opt);
    expect(parse('not json')).toEqual([]);
    expect(parse('{"scores": "not array"}')).toEqual([]);
    expect(parse('{"scores": []}')).toEqual([]);
  });

  it('should maintain backward compatibility with existing methods', () => {
    const opt = new ContextOptimizer({ maxContextTokens: 5000 });
    expect(opt.optimizeTools([], [], 'test')).toEqual({ tools: [], removed: [] });
    expect(opt.compactHistory([], [])).toEqual({ messages: [], compacted: 0 });
    expect(opt.truncateToolOutput('short', 'test')).toEqual({ content: 'short', truncated: false });
    expect(opt.estimateTokens([])).toBe(0);
  });
});
