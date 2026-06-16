import { getLogger } from '@titan/logging';
import { OpenAiProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'llm-factory' });

export interface ProviderConfig {
  type: 'openai' | 'openai-compatible' | 'anthropic';
  baseUrl?: string;
  apiKey: string;
  model: string;
  maxRetries?: number;
}

export function createLlmProvider(config: ProviderConfig): LlmProvider {
  log.info({ type: config.type, model: config.model, baseUrl: config.baseUrl }, 'creating LLM provider');

  switch (config.type) {
    case 'openai':
    case 'openai-compatible':
      return new OpenAiProvider({
        baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
        apiKey: config.apiKey,
        model: config.model,
        maxRetries: config.maxRetries ?? 2,
      });
    case 'anthropic':
      return new AnthropicProvider({
        baseUrl: config.baseUrl ?? 'https://api.anthropic.com',
        apiKey: config.apiKey,
        model: config.model,
      });
    default:
      throw new Error(`Unknown LLM provider type: ${(config as ProviderConfig).type}`);
  }
}

export function createProviderFromEnv(): LlmProvider | null {
  const type = process.env['LLM_PROVIDER_TYPE'] as 'openai' | 'openai-compatible' | 'anthropic' | undefined;
  const apiKey = process.env['LLM_API_KEY'];
  const model = process.env['LLM_MODEL'];
  const baseUrl = process.env['LLM_BASE_URL'];

  if (!type || !apiKey || !model) {
    log.error('LLM_PROVIDER_TYPE, LLM_API_KEY, and LLM_MODEL must all be set. Agent will not function without a real LLM provider.');
    return null;
  }

  return createLlmProvider({ type, apiKey, model, baseUrl });
}
