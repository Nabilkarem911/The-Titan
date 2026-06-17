import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProviderFromEnv, createLlmProvider } from './factory.js';
import { OpenAiProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';

describe('createLlmProvider', () => {
  it('creates an OpenAiProvider for type "openai"', () => {
    const provider = createLlmProvider({
      type: 'openai',
      apiKey: 'sk-test-key',
      model: 'gpt-4o',
    });
    expect(provider).toBeInstanceOf(OpenAiProvider);
  });

  it('creates an OpenAiProvider for type "openai-compatible" with custom baseUrl', () => {
    const provider = createLlmProvider({
      type: 'openai-compatible',
      apiKey: 'sk-custom-key',
      model: 'local-model',
      baseUrl: 'https://my-custom-endpoint.example.com/v1',
    });
    expect(provider).toBeInstanceOf(OpenAiProvider);
  });

  it('creates an AnthropicProvider for type "anthropic"', () => {
    const provider = createLlmProvider({
      type: 'anthropic',
      apiKey: 'sk-ant-test-key',
      model: 'claude-sonnet-4-20250514',
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('throws on unknown provider type', () => {
    expect(() =>
      createLlmProvider({
        type: 'gemini' as 'openai',
        apiKey: 'key',
        model: 'model',
      }),
    ).toThrow('Unknown LLM provider type');
  });
});

describe('createProviderFromEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env['LLM_PROVIDER_TYPE'];
    delete process.env['LLM_API_KEY'];
    delete process.env['LLM_MODEL'];
    delete process.env['LLM_BASE_URL'];
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  it('returns null when LLM_PROVIDER_TYPE is not set', () => {
    process.env['LLM_API_KEY'] = 'sk-test';
    process.env['LLM_MODEL'] = 'gpt-4o';

    const provider = createProviderFromEnv();
    expect(provider).toBeNull();
  });

  it('returns null when LLM_API_KEY is not set', () => {
    process.env['LLM_PROVIDER_TYPE'] = 'openai';
    process.env['LLM_MODEL'] = 'gpt-4o';

    const provider = createProviderFromEnv();
    expect(provider).toBeNull();
  });

  it('returns null when LLM_MODEL is not set', () => {
    process.env['LLM_PROVIDER_TYPE'] = 'openai';
    process.env['LLM_API_KEY'] = 'sk-test';

    const provider = createProviderFromEnv();
    expect(provider).toBeNull();
  });

  it('returns null when all required env vars are missing', () => {
    const provider = createProviderFromEnv();
    expect(provider).toBeNull();
  });

  it('creates OpenAiProvider when LLM_PROVIDER_TYPE=openai', () => {
    process.env['LLM_PROVIDER_TYPE'] = 'openai';
    process.env['LLM_API_KEY'] = 'sk-test-key';
    process.env['LLM_MODEL'] = 'gpt-4o';

    const provider = createProviderFromEnv();
    expect(provider).toBeInstanceOf(OpenAiProvider);
  });

  it('creates AnthropicProvider when LLM_PROVIDER_TYPE=anthropic', () => {
    process.env['LLM_PROVIDER_TYPE'] = 'anthropic';
    process.env['LLM_API_KEY'] = 'sk-ant-test-key';
    process.env['LLM_MODEL'] = 'claude-sonnet-4-20250514';

    const provider = createProviderFromEnv();
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('creates OpenAiProvider with custom baseUrl when LLM_PROVIDER_TYPE=openai-compatible', () => {
    process.env['LLM_PROVIDER_TYPE'] = 'openai-compatible';
    process.env['LLM_API_KEY'] = 'sk-custom-key';
    process.env['LLM_MODEL'] = 'local-llama';
    process.env['LLM_BASE_URL'] = 'https://my-llm.example.com';

    const provider = createProviderFromEnv();
    expect(provider).toBeInstanceOf(OpenAiProvider);
  });

  it('creates provider without LLM_BASE_URL (uses default)', () => {
    process.env['LLM_PROVIDER_TYPE'] = 'openai';
    process.env['LLM_API_KEY'] = 'sk-test-key';
    process.env['LLM_MODEL'] = 'gpt-4o';
    // LLM_BASE_URL intentionally not set

    const provider = createProviderFromEnv();
    expect(provider).not.toBeNull();
    expect(provider).toBeInstanceOf(OpenAiProvider);
  });
});
