import { describe, it, expect, vi } from 'vitest';
import { MultiModelRouter, type ModelConfig } from './multi-model-router.js';
import type { LlmProvider, LlmCompletion } from '../types.js';

function mockProvider(name: string, fail = false): LlmProvider {
  return {
    complete: fail
      ? vi.fn().mockRejectedValue(new Error(`${name} failed`))
      : vi.fn().mockResolvedValue({ content: `Response from ${name}`, tokensUsed: 50, finishReason: 'stop' } as LlmCompletion),
  };
}

function makeModels(): ModelConfig[] {
  return [
    { name: 'gpt-4o', provider: mockProvider('gpt-4o'), costPer1kTokens: 10, maxTokens: 128000, speed: 'medium', capability: 'advanced', priority: 10, taskCategories: ['coding', 'debugging', 'architecture', 'multi-step-planning', 'research', 'agentic'] },
    { name: 'gpt-4o-mini', provider: mockProvider('gpt-4o-mini'), costPer1kTokens: 0.5, maxTokens: 128000, speed: 'fast', capability: 'standard', priority: 5, taskCategories: ['classification', 'extraction', 'formatting', 'simple-qa', 'summarization', 'translation'] },
    { name: 'claude-haiku', provider: mockProvider('claude-haiku'), costPer1kTokens: 0.8, maxTokens: 200000, speed: 'fast', capability: 'basic', priority: 3, taskCategories: ['simple-qa', 'formatting'] },
  ];
}

describe('MultiModelRouter', () => {
  it('routes to highest priority model by default', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models);

    const result = await router.complete([{ role: 'user', content: 'Hello' }]);
    expect(result.content).toContain('gpt-4o');
    expect(models[0].provider.complete).toHaveBeenCalled();
  });

  it('routes to cheapest model with cheapest strategy', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, { strategy: 'cheapest' });

    const result = await router.complete([{ role: 'user', content: 'Hello' }]);
    expect(result.content).toContain('gpt-4o-mini');
  });

  it('routes to fastest model with fastest strategy', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, { strategy: 'fastest' });

    const result = await router.complete([{ role: 'user', content: 'Hello' }]);
    // gpt-4o-mini and claude-haiku are both 'fast', one of them should be selected
    expect(result.content).toMatch(/gpt-4o-mini|claude-haiku/);
  });

  it('falls back on failure', async () => {
    const models: ModelConfig[] = [
      { name: 'primary', provider: mockProvider('primary', true), costPer1kTokens: 10, maxTokens: 128000, speed: 'medium', capability: 'advanced', priority: 10 },
      { name: 'fallback', provider: mockProvider('fallback'), costPer1kTokens: 5, maxTokens: 128000, speed: 'fast', capability: 'standard', priority: 5 },
    ];

    const router = new MultiModelRouter(models, { fallbackEnabled: true });
    const result = await router.complete([{ role: 'user', content: 'Hello' }]);
    expect(result.content).toContain('fallback');
  });

  it('throws when no fallback and primary fails', async () => {
    const models: ModelConfig[] = [
      { name: 'only', provider: mockProvider('only', true), costPer1kTokens: 10, maxTokens: 128000, speed: 'medium', capability: 'advanced', priority: 10 },
    ];

    const router = new MultiModelRouter(models, { fallbackEnabled: false });
    await expect(router.complete([{ role: 'user', content: 'Hello' }])).rejects.toThrow();
  });

  it('selects model for task complexity', () => {
    const models = makeModels();
    const router = new MultiModelRouter(models);

    const simple = router.selectForTask('simple');
    expect(simple).toBeDefined();

    const complex = router.selectForTask('complex');
    expect(complex?.capability).toBe('advanced');
  });

  it('adds and removes models', () => {
    const router = new MultiModelRouter([]);
    router.addModel({ name: 'new', provider: mockProvider('new'), costPer1kTokens: 1, maxTokens: 1000, speed: 'fast', capability: 'basic', priority: 1 });
    expect(router.listModels().length).toBe(1);

    router.removeModel('new');
    expect(router.listModels().length).toBe(0);
  });

  it('uses round robin strategy', async () => {
    const models: ModelConfig[] = [
      { name: 'a', provider: mockProvider('a'), costPer1kTokens: 1, maxTokens: 1000, speed: 'fast', capability: 'basic', priority: 5 },
      { name: 'b', provider: mockProvider('b'), costPer1kTokens: 1, maxTokens: 1000, speed: 'fast', capability: 'basic', priority: 5 },
    ];

    const router = new MultiModelRouter(models, { strategy: 'round_robin' });
    const r1 = await router.complete([{ role: 'user', content: 'Hello' }]);
    const r2 = await router.complete([{ role: 'user', content: 'Hello' }]);

    // Should route to different models
    expect(r1.content).not.toBe(r2.content);
  });

  // ===== Smart Routing Tests =====

  it('smart strategy routes simple questions to cheapest model', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, { strategy: 'smart' });

    const result = await router.complete([{ role: 'user', content: 'What is 2+2?' }]);
    expect(result.content).toContain('gpt-4o-mini');
  });

  it('smart strategy routes coding tasks to advanced model', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, { strategy: 'smart' });

    const result = await router.complete([{ role: 'user', content: 'Debug this function and refactor the architecture to be more scalable' }]);
    expect(result.content).toContain('gpt-4o');
  });

  it('smart strategy routes classification to cheapest capable model', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, { strategy: 'smart' });

    const result = await router.complete([{ role: 'user', content: 'Classify this text into categories' }]);
    expect(result.content).toContain('gpt-4o-mini');
  });

  it('tracks routing stats', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, { strategy: 'smart' });

    await router.complete([{ role: 'user', content: 'What is the meaning of life?' }]);
    await router.complete([{ role: 'user', content: 'Debug this code function' }]);

    const stats = router.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.totalTokensUsed).toBe(100);
    expect(stats.totalCost).toBeGreaterThan(0);
    expect(stats.byModel.length).toBeGreaterThan(0);
    expect(stats.byComplexity.length).toBeGreaterThan(0);
    expect(stats.byCategory.length).toBeGreaterThan(0);
  });

  it('enforces token budget with degradation', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, {
      strategy: 'best',
      tokenBudget: 10,
      degradeOnBudgetExceeded: true,
    });

    // First call uses 50 tokens, exceeding the 10 token budget
    const result = await router.complete([{ role: 'user', content: 'Hello' }]);
    expect(result.content).toBeDefined();

    // Second call should degrade to cheaper model
    const result2 = await router.complete([{ role: 'user', content: 'Hello again' }]);
    expect(result2.content).toBeDefined();

    const budget = router.getBudgetRemaining();
    expect(budget?.tokens).toBe(0);
  });

  it('enforces cost budget', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, {
      strategy: 'best',
      costBudget: 0.01,
      degradeOnBudgetExceeded: true,
    });

    const result = await router.complete([{ role: 'user', content: 'Hello' }]);
    expect(result.content).toBeDefined();

    const budget = router.getBudgetRemaining();
    expect(budget?.cost).toBeDefined();
  });

  it('selectForTask works with ultra complexity', () => {
    const models = makeModels();
    const router = new MultiModelRouter(models);

    const ultra = router.selectForTask('ultra');
    expect(ultra).toBeDefined();
    expect(ultra?.capability).toBe('advanced');
  });

  it('selectForTask with smart strategy picks cheapest for simple', () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, { strategy: 'smart' });

    const simple = router.selectForTask('simple');
    expect(simple).toBeDefined();
    expect(simple?.costPer1kTokens).toBe(0.5); // gpt-4o-mini is cheapest
  });

  it('clearTraces resets stats', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models);

    await router.complete([{ role: 'user', content: 'Hello' }]);
    expect(router.getStats().totalRequests).toBe(1);

    router.clearTraces();
    expect(router.getStats().totalRequests).toBe(0);
  });

  it('calculates cost savings vs max model', async () => {
    const models = makeModels();
    const router = new MultiModelRouter(models, { strategy: 'cheapest' });

    await router.complete([{ role: 'user', content: 'Hello' }]);

    const stats = router.getStats();
    // Since we used cheapest model, savings should be > 0
    expect(stats.costSavingsVsMaxModel).toBeGreaterThan(0);
  });
});
