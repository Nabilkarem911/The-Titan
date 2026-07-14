import { getLogger } from '@titan/logging';
import { observeHistogram, incCounter } from '@titan/observability';
import type { LlmProvider, LlmMessage, LlmCompletion, LlmToolDefinition, ToolCall } from '../types.js';

const log = getLogger().child({ component: 'llm-anthropic' });

interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxRetries?: number;
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

    // Build Anthropic-format messages with proper tool_use/tool_result blocks
    const conversation: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }> = [];
    let toolUseIdCounter = 0;
    let lastToolUseId = '';

    for (const m of messages) {
      if (m.role === 'system') continue;

      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        // Assistant message with tool_use blocks
        const content: Array<Record<string, unknown>> = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls) {
          const id = `toolu_${toolUseIdCounter++}`;
          lastToolUseId = id;
          content.push({ type: 'tool_use', id, name: tc.name, input: tc.params });
        }
        conversation.push({ role: 'assistant', content });
      } else if (m.role === 'tool') {
        // Tool result must be a user message with tool_result content block
        const resultContent = m.toolResult
          ? (m.toolResult.success
              ? (typeof m.toolResult.data === 'string' ? m.toolResult.data : JSON.stringify(m.toolResult.data))
              : `Error: ${m.toolResult.error}`)
          : m.content;
        conversation.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: lastToolUseId || `toolu_${toolUseIdCounter++}`, content: resultContent.slice(0, 4000) }],
        });
      } else {
        // Plain user or assistant text message
        const role = m.role === 'user' ? 'user' : 'assistant';
        // Merge consecutive same-role messages (Anthropic rejects them)
        if (conversation.length > 0 && conversation[conversation.length - 1].role === role && typeof conversation[conversation.length - 1].content === 'string') {
          conversation[conversation.length - 1].content += '\n' + m.content;
        } else {
          conversation.push({ role, content: m.content });
        }
      }
    }

    const body = {
      model: this.config.model,
      max_tokens: opts?.maxTokens ?? 4096,
      temperature: opts?.temperature ?? 0.7,
      system: systemMsg || undefined,
      messages: conversation,
      tools: (opts?.tools && opts.tools.length > 0) ? opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })) : undefined,
    };

    // Retry loop with exponential backoff for transient errors
    const maxRetries = this.config.maxRetries ?? 2;
    let lastErr: Error | undefined;
    let res: Response | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
        log.info({ attempt, delayMs }, 'retrying Anthropic request after transient error');
        await new Promise((r) => setTimeout(r, delayMs));
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const text = await res.text();
          // Retry on transient HTTP errors (502, 503, 504, 429)
          if ([502, 503, 504, 429].includes(res.status)) {
            lastErr = new Error(`Anthropic API error ${res.status}: ${text}`);
            log.warn({ status: res.status, attempt, maxRetries }, 'transient Anthropic error, will retry');
            continue;
          }
          log.error({ status: res.status, body: text }, 'Anthropic API error');
          throw new Error(`Anthropic API error ${res.status}: ${text}`);
        }
        break; // success
      } catch (err) {
        clearTimeout(timeout);
        if ((err as Error).name === 'AbortError') {
          lastErr = new Error('Anthropic request timed out after 60s');
          log.warn({ attempt, maxRetries }, 'Anthropic timeout, will retry');
          continue;
        }
        // Network / fetch errors are retriable
        lastErr = err as Error;
        log.warn({ err: (err as Error).message, attempt, maxRetries }, 'Anthropic fetch error, will retry');
        continue;
      }
    }
    if (!res || !res.ok) {
      throw lastErr ?? new Error('Anthropic request failed after retries');
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
