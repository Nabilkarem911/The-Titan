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
      messages: stripOrphanToolResponses(buildApiMessages(messages)),
      max_tokens: opts?.maxTokens ?? 4096,
      temperature: opts?.temperature ?? 0.7,
      tools: (opts?.tools && opts.tools.length > 0) ? opts.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })) : undefined,
      tool_choice: (opts?.tools && opts.tools.length > 0) ? 'auto' : undefined,
    };

    // Retry loop with exponential backoff for transient errors
    const maxRetries = this.config.maxRetries ?? 2;
    let lastErr: Error | undefined;
    let res: Response | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
        log.info({ attempt, delayMs }, 'retrying LLM request after transient error');
        await new Promise((r) => setTimeout(r, delayMs));
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const text = await res.text();
          // Retry on transient HTTP errors (502, 503, 504, 429)
          if ([502, 503, 504, 429].includes(res.status)) {
            lastErr = new Error(`OpenAI API error ${res.status}: ${text}`);
            log.warn({ status: res.status, attempt, maxRetries }, 'transient LLM error, will retry');
            continue;
          }
          log.error({ status: res.status, body: text }, 'OpenAI API error');
          throw new Error(`OpenAI API error ${res.status}: ${text}`);
        }
        break; // success
      } catch (err) {
        clearTimeout(timeout);
        if ((err as Error).name === 'AbortError') {
          lastErr = new Error('LLM request timed out after 60s');
          log.warn({ attempt, maxRetries }, 'LLM timeout, will retry');
          continue;
        }
        // Network / fetch errors are retriable
        lastErr = err as Error;
        log.warn({ err: (err as Error).message, attempt, maxRetries }, 'LLM fetch error, will retry');
        continue;
      }
    }
    if (!res || !res.ok) {
      throw lastErr ?? new Error('LLM request failed after retries');
    }

    const data = (await res.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          reasoning_content?: string;
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

    const reasoningContent = choice.message.reasoning_content || undefined;

    if (reasoningContent) {
      log.debug({ model: this.config.model, reasoningLen: reasoningContent.length }, 'reasoning_content extracted from LLM response');
    }
    const hasReasoningInMessages = messages.some(m => m.role === 'assistant' && m.reasoningContent);
    if (hasReasoningInMessages && !reasoningContent) {
      log.warn({ model: this.config.model }, 'reasoning_content was in messages but not returned by LLM — DeepSeek may require it');
    }

    const latency = Math.round(performance.now() - start);
    observeHistogram('llm_request_duration_ms', 'LLM request latency', latency, [100, 250, 500, 1000, 2500, 5000, 10000, 30000]);
    incCounter('llm_requests_total', 'Total LLM requests', 1, { provider: 'openai', model: this.config.model });
    incCounter('llm_tokens_total', 'Total LLM tokens used', data.usage?.total_tokens ?? 0, { provider: 'openai', model: this.config.model });

    return {
      content: choice.message.content ?? '',
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      tokensUsed: data.usage?.total_tokens ?? 0,
      finishReason: mapFinishReason(choice.finish_reason),
      reasoningContent,
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
      messages: stripOrphanToolResponses(buildApiMessages(messages)),
      max_tokens: opts?.maxTokens ?? 4096,
      temperature: opts?.temperature ?? 0.7,
      stream: true,
    };

    const streamController = new AbortController();
    const streamTimeout = setTimeout(() => streamController.abort(), 90_000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify(body),
        signal: streamController.signal,
      });
    } catch (err) {
      clearTimeout(streamTimeout);
      if ((err as Error).name === 'AbortError') throw new Error('LLM stream request timed out after 90s');
      throw err;
    }
    clearTimeout(streamTimeout);

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

function buildApiMessages(messages: LlmMessage[]): Record<string, unknown>[] {
  let toolCallCounter = 0;
  let lastToolCallId = '';
  let reasoningInjected = 0;
  const result = messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const calls = m.toolCalls.map((tc, idx) => {
        const id = `call_${toolCallCounter++}_${idx}`;
        lastToolCallId = id;
        return {
          id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.params) },
        };
      });
      const msg: Record<string, unknown> = {
        role: 'assistant' as const,
        content: m.content || null,
        tool_calls: calls,
      };
      if (m.reasoningContent) {
        msg['reasoning_content'] = m.reasoningContent;
        reasoningInjected++;
      }
      return msg;
    }
    if (m.role === 'assistant' && m.reasoningContent) {
      reasoningInjected++;
      return {
        role: 'assistant' as const,
        content: m.content || null,
        reasoning_content: m.reasoningContent,
      };
    }
    if (m.role === 'tool') {
      return {
        role: 'tool' as const,
        content: m.content,
        tool_call_id: lastToolCallId || `call_${toolCallCounter++}_0`,
      };
    }
    return { role: m.role, content: m.content };
  });
  if (reasoningInjected > 0) {
    log.debug({ reasoningInjected, totalMessages: messages.length }, 'reasoning_content injected into API messages');
  }
  return result;
}

function stripOrphanToolResponses(messages: Record<string, unknown>[]): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  for (const msg of messages) {
    if (msg['role'] === 'tool') {
      const hasPrecedingToolCall = result.some(
        (prev) => prev['role'] === 'assistant' && Array.isArray(prev['tool_calls']) && (prev['tool_calls'] as unknown[]).length > 0,
      );
      if (!hasPrecedingToolCall) {
        log.warn('stripping orphan tool response — no preceding assistant tool_call');
        continue;
      }
    }
    result.push(msg);
  }
  return result;
}

function mapFinishReason(reason: string): LlmCompletion['finishReason'] {
  if (reason === 'tool_calls') return 'tool_calls';
  if (reason === 'length') return 'length';
  if (reason === 'content_filter') return 'content_filter';
  return 'stop';
}
