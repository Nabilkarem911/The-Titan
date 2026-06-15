import { getLogger } from '@titan/logging';
import { observeHistogram, incCounter } from '@titan/observability';
import type { LlmProvider, LlmMessage, LlmCompletion, LlmToolDefinition, ToolCall } from '../types.js';

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
    opts?: { maxTokens?: number; temperature?: number; tools?: LlmToolDefinition[] },
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
      tools: (opts?.tools ?? []).map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice: (opts?.tools ?? []).length > 0 ? 'auto' : undefined,
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

  async *stream(
    messages: LlmMessage[],
    opts?: { maxTokens?: number; temperature?: number },
  ): AsyncGenerator<string> {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const url = `${base.endsWith('/v1') ? base : `${base}/v1`}/chat/completions`;
    const body = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role === 'tool' ? 'assistant' : m.role, content: m.content })),
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.3,
      stream: true,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(`OpenAI stream error ${res.status}: ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const chunk = JSON.parse(data) as { choices: Array<{ delta: { content?: string } }> };
          const text = chunk.choices[0]?.delta?.content;
          if (text) yield text;
        } catch {
          // skip malformed chunks
        }
      }
    }
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
