import { getLogger } from '@titan/logging';
import { observeHistogram, incCounter } from '@titan/observability';
import type { LlmProvider, LlmMessage, LlmCompletion, ToolCall } from '../types.js';

const log = getLogger().child({ component: 'llm-openai' });

export interface OpenAiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxRetries?: number;
}

export class OpenAiProvider implements LlmProvider {
  constructor(private config: OpenAiProviderConfig) {}

  async complete(
    messages: LlmMessage[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<LlmCompletion> {
    const start = performance.now();
    const base = this.config.baseUrl.replace(/\/$/, '');
    const url = `${base.endsWith('/v1') ? base : `${base}/v1`}/chat/completions`;
    const body = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role === 'tool' ? 'assistant' : m.role,
        content: m.content,
      })),
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.3,
      tools: [
        {
          type: 'function',
          function: {
            name: 'execute_bash',
            description: 'Execute a bash command',
            parameters: {
              type: 'object',
              properties: {
                command: { type: 'string', description: 'The bash command to execute' },
              },
              required: ['command'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read a file content',
            parameters: {
              type: 'object',
              properties: {
                filePath: { type: 'string' },
                offset: { type: 'number' },
                limit: { type: 'number' },
              },
              required: ['filePath'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'patch_file',
            description: 'Apply a unified diff patch to a file',
            parameters: {
              type: 'object',
              properties: {
                filePath: { type: 'string' },
                patch: { type: 'string' },
              },
              required: ['filePath', 'patch'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'firecrawl_scrape',
            description: 'Scrape a URL and return plain text',
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string' },
              },
              required: ['url'],
            },
          },
        },
      ],
      tool_choice: 'auto',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      log.error({ status: res.status, body: text }, 'OpenAI API error');
      throw new Error(`OpenAI API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage?: { total_tokens: number };
    };

    const choice = data.choices[0];
    if (!choice) throw new Error('No choices in OpenAI response');

    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
      name: tc.function.name,
      params: parseJsonSafe(tc.function.arguments),
    }));

    const latency = Math.round(performance.now() - start);
    observeHistogram('llm_request_duration_ms', 'LLM request latency', latency, [100, 250, 500, 1000, 2500, 5000, 10000, 30000]);
    incCounter('llm_requests_total', 'Total LLM requests', 1, { provider: 'openai', model: this.config.model });
    incCounter('llm_tokens_total', 'Total LLM tokens used', data.usage?.total_tokens ?? 0, { provider: 'openai', model: this.config.model });

    return {
      content: choice.message.content ?? '',
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      tokensUsed: data.usage?.total_tokens ?? 0,
      finishReason: mapFinishReason(choice.finish_reason),
    };
  }
}

function parseJsonSafe(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

function mapFinishReason(reason: string): LlmCompletion['finishReason'] {
  if (reason === 'tool_calls') return 'tool_calls';
  if (reason === 'length') return 'length';
  if (reason === 'content_filter') return 'content_filter';
  return 'stop';
}
