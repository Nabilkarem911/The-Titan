import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import type { LlmMessage, LlmToolDefinition, ToolCall, AgentStep, LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'context-optimizer' });

export interface ContextOptimizationOptions {
  maxContextTokens?: number;
  maxToolOutputTokens?: number;
  maxConversationMessages?: number;
  enableToolFiltering?: boolean;
  enableHistoryCompaction?: boolean;
  enableOutputTruncation?: boolean;
  enableLearnedCompression?: boolean;
  budget?: ContextBudget;
}

export interface ContextBudget {
  code: number;       // percentage for code/file context
  history: number;    // percentage for conversation history
  tools: number;      // percentage for tool definitions
  reserve: number;    // percentage reserved for response
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

export interface ContextItem {
  id: string;
  type: 'code' | 'history' | 'tool' | 'system' | 'memory';
  content: string;
  tokenEstimate: number;
  relevanceScore?: number;
}

export interface LearnedCompressionResult {
  items: ContextItem[];
  tokensSaved: number;
  tokensUsed: number;
  budgetAllocation: ContextBudget;
}

const DEFAULTS: Required<ContextOptimizationOptions> = {
  maxContextTokens: 32000,
  maxToolOutputTokens: 2000,
  maxConversationMessages: 20,
  enableToolFiltering: true,
  enableHistoryCompaction: true,
  enableOutputTruncation: true,
  enableLearnedCompression: false,
  budget: { code: 40, history: 30, tools: 20, reserve: 10 },
};

const DEFAULT_BUDGET: ContextBudget = { code: 40, history: 30, tools: 20, reserve: 10 };

const SCORING_PROMPT = `You are a context relevance scorer for an AI agent. Score each context item for relevance to the current task.

For each item, return a relevance score from 0.0 to 1.0:
- 1.0 = Critical, directly needed for the task
- 0.7 = Important, likely needed
- 0.4 = Somewhat relevant, might be useful
- 0.1 = Not relevant, can be safely removed

Respond in JSON:
{"scores": [{"id": "item-id", "score": 0.0-1.0}]}`;

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

  // ── Learned Context Compression ──

  getBudget(): ContextBudget {
    return { ...this.opts.budget };
  }

  setBudget(budget: ContextBudget): void {
    const total = budget.code + budget.history + budget.tools + budget.reserve;
    if (Math.abs(total - 100) > 1) {
      log.warn({ total }, 'budget percentages do not sum to 100, normalizing');
      const factor = 100 / total;
      this.opts.budget = {
        code: Math.round(budget.code * factor),
        history: Math.round(budget.history * factor),
        tools: Math.round(budget.tools * factor),
        reserve: Math.round(budget.reserve * factor),
      };
    } else {
      this.opts.budget = { ...budget };
    }
  }

  calculateBudgetAllocation(totalTokens: number): { code: number; history: number; tools: number; reserve: number } {
    const b = this.opts.budget;
    return {
      code: Math.floor(totalTokens * b.code / 100),
      history: Math.floor(totalTokens * b.history / 100),
      tools: Math.floor(totalTokens * b.tools / 100),
      reserve: Math.floor(totalTokens * b.reserve / 100),
    };
  }

  async scoreContextItems(
    llm: LlmProvider,
    items: ContextItem[],
    taskPrompt: string,
  ): Promise<ContextItem[]> {
    if (items.length === 0) return [];

    try {
      const itemsJson = items.map((i) => ({
        id: i.id,
        type: i.type,
        preview: i.content.slice(0, 200),
      }));

      const response = await llm.complete([
        { role: 'system', content: SCORING_PROMPT },
        {
          role: 'user',
          content: `Task: ${taskPrompt.slice(0, 500)}\n\nContext items:\n${JSON.stringify(itemsJson, null, 2)}`,
        },
      ], { temperature: 0.1, maxTokens: 800 });

      const scores = this.parseScores(response.content);
      const scored = items.map((item) => {
        const scoreEntry = scores.find((s) => s.id === item.id);
        return { ...item, relevanceScore: scoreEntry?.score ?? 0.5 };
      });

      incCounter('ctx_learned_scoring', 'Learned context scoring calls', 1);
      return scored;
    } catch (err) {
      log.warn({ err }, 'learned context scoring failed — using default scores');
      return items.map((i) => ({ ...i, relevanceScore: 0.5 }));
    }
  }

  async compressContext(
    llm: LlmProvider,
    items: ContextItem[],
    taskPrompt: string,
  ): Promise<LearnedCompressionResult> {
    const totalBudget = this.opts.maxContextTokens;
    const allocation = this.calculateBudgetAllocation(totalBudget);

    // Score items if learned compression is enabled
    let scoredItems: ContextItem[];
    if (this.opts.enableLearnedCompression) {
      scoredItems = await this.scoreContextItems(llm, items, taskPrompt);
    } else {
      // Preserve existing scores, default to 0.5 if not set
      scoredItems = items.map((i) => ({ ...i, relevanceScore: i.relevanceScore ?? 0.5 }));
    }

    // Group by type and sort by relevance score
    const byType = new Map<ContextItem['type'], ContextItem[]>();
    for (const item of scoredItems) {
      const group = byType.get(item.type) ?? [];
      group.push(item);
      byType.set(item.type, group);
    }

    const budgetMap: Record<string, number> = {
      code: allocation.code,
      history: allocation.history,
      tool: allocation.tools,
      system: allocation.reserve,
      memory: allocation.reserve,
    };

    const result: ContextItem[] = [];
    let tokensUsed = 0;

    for (const [type, group] of byType) {
      const budget = budgetMap[type] ?? allocation.reserve;
      const sorted = group.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));

      let typeTokens = 0;
      for (const item of sorted) {
        if (typeTokens + item.tokenEstimate > budget) break;
        result.push(item);
        typeTokens += item.tokenEstimate;
        tokensUsed += item.tokenEstimate;
      }
    }

    const originalTokens = items.reduce((s, i) => s + i.tokenEstimate, 0);
    const tokensSaved = originalTokens - tokensUsed;

    incCounter('ctx_learned_compressions', 'Learned context compressions', 1);
    observeHistogram('ctx_learned_tokens_saved', 'Tokens saved by learned compression', tokensSaved);

    log.info({
      itemCount: items.length,
      keptCount: result.length,
      tokensSaved,
      tokensUsed,
      budget: this.opts.budget,
    }, 'learned context compression completed');

    return {
      items: result,
      tokensSaved,
      tokensUsed,
      budgetAllocation: this.opts.budget,
    };
  }

  buildContextItems(
    messages: LlmMessage[],
    tools: LlmToolDefinition[],
    steps: AgentStep[],
  ): ContextItem[] {
    const items: ContextItem[] = [];

    for (const msg of messages) {
      const type: ContextItem['type'] = msg.role === 'system' ? 'system' : 'history';
      items.push({
        id: `msg-${items.length}`,
        type,
        content: msg.content,
        tokenEstimate: Math.ceil(msg.content.length / 4),
      });
    }

    for (const tool of tools) {
      items.push({
        id: `tool-${tool.name}`,
        type: 'tool',
        content: `${tool.name}: ${tool.description}`,
        tokenEstimate: Math.ceil((tool.description.length + JSON.stringify(tool.parameters).length) / 4),
      });
    }

    for (const step of steps) {
      if (step.thought) {
        items.push({
          id: `step-${step.index}`,
          type: 'history',
          content: step.thought,
          tokenEstimate: Math.ceil(step.thought.length / 4),
        });
      }
    }

    return items;
  }

  private parseScores(content: string): Array<{ id: string; score: number }> {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as { scores?: Array<{ id?: string; score?: number }> };
      if (!Array.isArray(parsed.scores)) return [];

      return parsed.scores
        .filter((s) => s.id !== undefined)
        .map((s) => ({
          id: s.id!,
          score: Math.max(0, Math.min(1, s.score ?? 0.5)),
        }));
    } catch {
      return [];
    }
  }
}
