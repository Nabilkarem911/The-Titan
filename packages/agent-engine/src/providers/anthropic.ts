import { getLogger } from '@titan/logging';
import type { LlmProvider, LlmMessage, LlmCompletion, ToolCall } from '../types.js';

const log = getLogger().child({ component: 'llm-anthropic' });

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class AnthropicProvider implements LlmProvider {
  constructor(private config: AnthropicProviderConfig) {}

  async complete(
    messages: LlmMessage[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<LlmCompletion> {
    const url = `${(this.config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`;

    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
    const conversation = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content: m.content,
    }));

    const body = {
      model: this.config.model,
      max_tokens: opts?.maxTokens ?? 4096,
      temperature: opts?.temperature ?? 0.3,
      system: systemMsg || undefined,
      messages: conversation,
      tools: [
        {
          name: 'execute_bash',
          description: 'Execute a bash command',
          input_schema: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The bash command to execute' },
            },
            required: ['command'],
          },
        },
        {
          name: 'read_file',
          description: 'Read a file content',
          input_schema: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              offset: { type: 'number' },
              limit: { type: 'number' },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'patch_file',
          description: 'Apply a unified diff patch to a file',
          input_schema: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              patch: { type: 'string' },
            },
            required: ['filePath', 'patch'],
          },
        },
        {
          name: 'firecrawl_scrape',
          description: 'Scrape a URL and return plain text',
          input_schema: {
            type: 'object',
            properties: {
              url: { type: 'string' },
            },
            required: ['url'],
          },
        },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      log.error({ status: res.status, body: text }, 'Anthropic API error');
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; name: string; input: Record<string, unknown> }
      >;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string | null;
    };

    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({ name: block.name, params: block.input });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
      finishReason: mapFinishReason(data.stop_reason),
    };
  }
}

function mapFinishReason(reason: string | null): LlmCompletion['finishReason'] {
  if (reason === 'tool_use') return 'tool_calls';
  if (reason === 'max_tokens') return 'length';
  if (reason === 'content_filter') return 'content_filter';
  return 'stop';
}
