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
    { name: 'gpt-4o', provider: mockProvider('gpt-4o'), costPer1kTokens: 10, maxTokens: 128000, speed: 'medium', capability: 'advanced', priority: 10 },
    { name: 'gpt-4o-mini', provider: mockProvider('gpt-4o-mini'), costPer1kTokens: 0.5, maxTokens: 128000, speed: 'fast', capability: 'standard', priority: 5 },
    { name: 'claude-haiku', provider: mockProvider('claude-haiku'), costPer1kTokens: 0.8, maxTokens: 200000, speed: 'fast', capability: 'basic', priority: 3 },
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
});
