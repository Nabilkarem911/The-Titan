import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import type { LlmMessage, LlmToolDefinition, ToolCall, AgentStep } from '../types.js';

const log = getLogger().child({ component: 'context-optimizer' });

export interface ContextOptimizationOptions {
  maxContextTokens?: number;
  maxToolOutputTokens?: number;
  maxConversationMessages?: number;
  enableToolFiltering?: boolean;
  enableHistoryCompaction?: boolean;
  enableOutputTruncation?: boolean;
}

export interface ContextStats {
  originalTokenEstimate: number;
  optimizedTokenEstimate: number;
  tokensSaved: number;
  toolsRemoved: number;
  messagesCompacted: number;
  outputsTruncated: number;
}

export interface ToolUsageStats {
  toolName: string;
  callCount: number;
  lastUsedStep: number;
}

const DEFAULTS: Required<ContextOptimizationOptions> = {
  maxContextTokens: 32000,
  maxToolOutputTokens: 2000,
  maxConversationMessages: 20,
  enableToolFiltering: true,
  enableHistoryCompaction: true,
  enableOutputTruncation: true,
};

export class ContextOptimizer {
  private opts: Required<ContextOptimizationOptions>;
  private toolUsageMap: Map<string, ToolUsageStats> = new Map();
  private totalTokensSaved = 0;
  private totalOptimizations = 0;

  constructor(opts?: ContextOptimizationOptions) {
    this.opts = { ...DEFAULTS, ...opts };
    log.info({ maxContextTokens: this.opts.maxContextTokens }, 'ContextOptimizer initialized');
  }

  optimizeTools(
    tools: LlmToolDefinition[],
    steps: AgentStep[],
    prompt: string,
  ): { tools: LlmToolDefinition[]; removed: string[] } {
    if (!this.opts.enableToolFiltering) {
      return { tools, removed: [] };
    }

    // Track tool usage from steps
    for (const step of steps) {
      if (step.action) {
        const existing = this.toolUsageMap.get(step.action.name);
        if (existing) {
          existing.callCount++;
          existing.lastUsedStep = step.index;
        } else {
          this.toolUsageMap.set(step.action.name, {
            toolName: step.action.name,
            callCount: 1,
            lastUsedStep: step.index,
          });
        }
      }
    }

    // Extract tool names mentioned in the prompt
    const promptLower = prompt.toLowerCase();
    const mentionedTools = new Set<string>();
    for (const tool of tools) {
      if (promptLower.includes(tool.name.toLowerCase())) {
        mentionedTools.add(tool.name);
      }
    }

    // Always keep tools that were used recently or mentioned in prompt
    const keep = new Set<string>();
    for (const tool of tools) {
      const usage = this.toolUsageMap.get(tool.name);
      const wasUsedRecently = usage && usage.lastUsedStep >= steps.length - 5;
      const wasMentioned = mentionedTools.has(tool.name);

      if (wasUsedRecently || wasMentioned) {
        keep.add(tool.name);
      }
    }

    // If we're under budget, keep everything
    const estimatedTokens = this.estimateToolTokens(tools);
    if (estimatedTokens <= this.opts.maxContextTokens * 0.3) {
      return { tools, removed: [] };
    }

    // Filter: keep essential tools + recently used + mentioned
    const essentialTools = new Set([
      'execute_bash', 'write_file', 'read_file', 'patch_file',
      'http_request', 'scrape', 'brave_search',
    ]);

    const filtered = tools.filter(t =>
      keep.has(t.name) ||
      essentialTools.has(t.name) ||
      t.name.startsWith('manage_') ||
      t.name.startsWith('set_') ||
      t.name.startsWith('get_') ||
      t.name.startsWith('remember') ||
      t.name.startsWith('recall'),
    );

    const removed = tools.filter(t => !filtered.includes(t)).map(t => t.name);

    if (removed.length > 0) {
      log.debug({ removed: removed.length, kept: filtered.length }, 'tools filtered from context');
      incCounter('ctx_tools_removed', 'Tools removed from context', removed.length);
    }

    return { tools: filtered, removed };
  }

  compactHistory(
    messages: LlmMessage[],
    steps: AgentStep[],
  ): { messages: LlmMessage[]; compacted: number } {
    if (!this.opts.enableHistoryCompaction) {
      return { messages, compacted: 0 };
    }

    // Keep system message + last N messages + compact the rest
    if (messages.length <= this.opts.maxConversationMessages) {
      return { messages, compacted: 0 };
    }

    const system = messages.filter(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    if (nonSystem.length <= this.opts.maxConversationMessages) {
      return { messages, compacted: 0 };
    }

    const keepCount = this.opts.maxConversationMessages;
    const toCompact = nonSystem.slice(0, nonSystem.length - keepCount);
    const toKeep = nonSystem.slice(nonSystem.length - keepCount);

    // Create a summary of compacted messages
    const summaryParts: string[] = [];
    let toolCallsSummarized = 0;
    let assistantMessagesSummarized = 0;

    for (const msg of toCompact) {
      if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            summaryParts.push(`[Used ${tc.name}]`);
            toolCallsSummarized++;
          }
        }
        if (msg.content && msg.content.length > 0) {
          summaryParts.push(`[Assistant: ${msg.content.slice(0, 100)}...]`);
          assistantMessagesSummarized++;
        }
      } else if (msg.role === 'tool') {
        const content = msg.content.slice(0, 200);
        summaryParts.push(`[Tool result: ${content}...]`);
      } else if (msg.role === 'user') {
        summaryParts.push(`[User: ${msg.content.slice(0, 100)}...]`);
      }
    }

    const compactedMessage: LlmMessage = {
      role: 'system',
      content: `--- Previous conversation summary (${toCompact.length} messages compacted) ---\n${summaryParts.join('\n')}`,
    };

    const result = [...system, compactedMessage, ...toKeep];
    const compactedCount = toCompact.length;

    log.debug({ compacted: compactedCount, remaining: toKeep.length }, 'conversation history compacted');
    incCounter('ctx_messages_compacted', 'Messages compacted from history', compactedCount);

    return { messages: result, compacted: compactedCount };
  }

  truncateToolOutput(
    content: string,
    toolName: string,
  ): { content: string; truncated: boolean } {
    if (!this.opts.enableOutputTruncation) {
      return { content, truncated: false };
    }

    const maxChars = this.opts.maxToolOutputTokens * 4; // ~4 chars per token
    if (content.length <= maxChars) {
      return { content, truncated: false };
    }

    // Smart truncation: keep beginning and end
    const headSize = Math.floor(maxChars * 0.6);
    const tailSize = Math.floor(maxChars * 0.3);
    const head = content.slice(0, headSize);
    const tail = content.slice(content.length - tailSize);
    const truncated = `${head}\n\n... [truncated ${content.length - headSize - tailSize} chars] ...\n\n${tail}`;

    log.debug({ tool: toolName, original: content.length, truncated: truncated.length }, 'tool output truncated');
    incCounter('ctx_outputs_truncated', 'Tool outputs truncated', 1);

    return { content: truncated, truncated: true };
  }

  estimateTokens(messages: LlmMessage[], tools?: LlmToolDefinition[]): number {
    let tokens = 0;
    for (const msg of messages) {
      tokens += Math.ceil(msg.content.length / 4);
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          tokens += Math.ceil(JSON.stringify(tc).length / 4);
        }
      }
    }
    if (tools) {
      tokens += this.estimateToolTokens(tools);
    }
    return tokens;
  }

  getStats(): ContextStats & { totalTokensSaved: number; totalOptimizations: number } {
    return {
      originalTokenEstimate: 0,
      optimizedTokenEstimate: 0,
      tokensSaved: this.totalTokensSaved,
      toolsRemoved: 0,
      messagesCompacted: 0,
      outputsTruncated: 0,
      totalTokensSaved: this.totalTokensSaved,
      totalOptimizations: this.totalOptimizations,
    };
  }

  private estimateToolTokens(tools: LlmToolDefinition[]): number {
    let tokens = 0;
    for (const tool of tools) {
      tokens += Math.ceil(tool.description.length / 4);
      tokens += Math.ceil(JSON.stringify(tool.parameters).length / 4);
      tokens += Math.ceil(tool.name.length / 4);
    }
    return tokens;
  }

  recordOptimization(tokensSaved: number): void {
    this.totalTokensSaved += tokensSaved;
    this.totalOptimizations++;
    observeHistogram('ctx_tokens_saved', 'Tokens saved by context optimization', tokensSaved);
  }
}
