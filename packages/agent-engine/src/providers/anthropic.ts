import { getLogger } from '@titan/logging';
import { observeHistogram, incCounter } from '@titan/observability';
import type { LlmProvider, LlmMessage, LlmCompletion, LlmToolDefinition, ToolCall } from '../types.js';

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
    opts?: { maxTokens?: number; temperature?: number; tools?: LlmToolDefinition[] },
  ): Promise<LlmCompletion> {
    const start = performance.now();
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
      tools: (opts?.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
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

    const latency = Math.round(performance.now() - start);
    const tokens = data.usage.input_tokens + data.usage.output_tokens;
    observeHistogram('llm_request_duration_ms', 'LLM request latency', latency, [100, 250, 500, 1000, 2500, 5000, 10000, 30000]);
    incCounter('llm_requests_total', 'Total LLM requests', 1, { provider: 'anthropic', model: this.config.model });
    incCounter('llm_tokens_total', 'Total LLM tokens used', tokens, { provider: 'anthropic', model: this.config.model });

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      tokensUsed: tokens,
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
