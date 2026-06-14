import { getLogger } from '@titan/logging';
import { OpenAiProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'llm-factory' });

export interface ProviderConfig {
  type: 'openai' | 'anthropic';
  baseUrl?: string;
  apiKey: string;
  model: string;
}

export function createLlmProvider(config: ProviderConfig): LlmProvider {
  log.info({ type: config.type, model: config.model, baseUrl: config.baseUrl }, 'creating LLM provider');

  switch (config.type) {
    case 'openai':
      return new OpenAiProvider({
        baseUrl: config.baseUrl ?? 'https://api.openai.com',
        apiKey: config.apiKey,
        model: config.model,
      });
    case 'anthropic':
      return new AnthropicProvider({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
      });
    default:
      throw new Error(`Unknown LLM provider type: ${(config as ProviderConfig).type}`);
  }
}

export function createProviderFromEnv(): LlmProvider | null {
  const type = process.env['LLM_PROVIDER_TYPE'] as 'openai' | 'anthropic' | undefined;
  const apiKey = process.env['LLM_API_KEY'];
  const model = process.env['LLM_MODEL'];
  const baseUrl = process.env['LLM_BASE_URL'];

  if (!type || !apiKey || !model) {
    log.warn('LLM environment variables not set; using mock provider');
    return null;
  }

  return createLlmProvider({ type, apiKey, model, baseUrl });
}
