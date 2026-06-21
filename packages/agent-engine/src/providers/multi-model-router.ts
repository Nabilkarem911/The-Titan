import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import type { LlmProvider, LlmMessage, LlmCompletion, LlmToolDefinition } from '../types.js';

const log = getLogger().child({ component: 'multi-model-router' });

export type TaskComplexity = 'simple' | 'medium' | 'complex' | 'ultra';

export type TaskCategory =
  | 'classification'
  | 'extraction'
  | 'formatting'
  | 'simple-qa'
  | 'summarization'
  | 'translation'
  | 'reasoning'
  | 'coding'
  | 'analysis'
  | 'debugging'
  | 'architecture'
  | 'multi-step-planning'
  | 'research'
  | 'creative'
  | 'agentic'
  | 'general';

export interface ModelConfig {
  name: string;
  provider: LlmProvider;
  costPer1kTokens: number;
  maxTokens: number;
  speed: 'fast' | 'medium' | 'slow';
  capability: 'basic' | 'standard' | 'advanced';
  priority: number;
  taskCategories?: TaskCategory[];
}

export interface RoutingPolicy {
  strategy: 'cheapest' | 'fastest' | 'best' | 'round_robin' | 'smart';
  fallbackEnabled: boolean;
  maxRetries: number;
  tokenBudget?: number;
  costBudget?: number;
  degradeOnBudgetExceeded?: boolean;
}

export interface RoutingTrace {
  selectedModel: string;
  taskComplexity: TaskComplexity;
  taskCategory: TaskCategory;
  complexityScore: number;
  estimatedCost: number;
  actualCost: number;
  tokensUsed: number;
  latencyMs: number;
  success: boolean;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  timestamp: Date;
}

export interface ProviderRoutingStats {
  totalRequests: number;
  totalTokensUsed: number;
  totalCost: number;
  costSavingsVsMaxModel: number;
  byModel: Array<{ name: string; count: number; tokens: number; cost: number }>;
  byComplexity: Array<{ complexity: TaskComplexity; count: number }>;
  byCategory: Array<{ category: TaskCategory; count: number }>;
  fallbackRate: number;
  avgLatencyMs: number;
  budgetRemaining?: { tokens?: number; cost?: number };
}

interface BudgetState {
  tokenBudget?: number;
  costBudget?: number;
  tokensUsed: number;
  costSpent: number;
}

export class MultiModelRouter implements LlmProvider {
  private models: ModelConfig[] = [];
  private policy: RoutingPolicy;
  private roundRobinIndex = 0;
  private failureCounts: Map<string, number> = new Map();
  private traces: RoutingTrace[] = [];
  private maxTraces = 500;
  private budget: BudgetState;

  constructor(models: ModelConfig[], policy?: Partial<RoutingPolicy>) {
    this.models = models.sort((a, b) => b.priority - a.priority);
    this.policy = {
      strategy: 'best',
      fallbackEnabled: true,
      maxRetries: 2,
      ...policy,
    };
    this.budget = {
      tokenBudget: policy?.tokenBudget,
      costBudget: policy?.costBudget,
      tokensUsed: 0,
      costSpent: 0,
    };
  }

  async complete(
    messages: LlmMessage[],
    opts?: { maxTokens?: number; temperature?: number; tools?: LlmToolDefinition[] },
  ): Promise<LlmCompletion> {
    const ordered = this.selectModels(messages, opts);
    let lastError: Error | null = null;
    let fallbackFrom: string | undefined;

    for (let i = 0; i < ordered.length; i++) {
      let model = ordered[i];
      // Budget check — degrade to cheaper model if budget exceeded
      if (this.isBudgetExceeded() && this.policy.degradeOnBudgetExceeded) {
        const cheaper = this.findCheaperModel(model);
        if (cheaper && cheaper.costPer1kTokens < model.costPer1kTokens) {
          log.warn({ original: model.name, degraded: cheaper.name }, 'budget exceeded — degrading to cheaper model');
          model = cheaper;
        }
      }

      const startTime = Date.now();
      try {
        log.debug({ model: model.name, strategy: this.policy.strategy }, 'routing to model');
        const result = await model.provider.complete(messages, opts);
        const latencyMs = Date.now() - startTime;

        // Reset failure count on success
        this.failureCounts.set(model.name, 0);

        // Track cost & tokens
        const tokensUsed = result.tokensUsed ?? 0;
        const actualCost = (tokensUsed / 1000) * model.costPer1kTokens;
        this.budget.tokensUsed += tokensUsed;
        this.budget.costSpent += actualCost;

        // Record trace
        this.recordTrace({
          selectedModel: model.name,
          taskComplexity: this.classifyComplexity(messages, opts),
          taskCategory: this.classifyCategory(messages),
          complexityScore: this.assessComplexityScore(messages),
          estimatedCost: (Math.min(model.maxTokens, this.estimateInputTokens(messages)) / 1000) * model.costPer1kTokens,
          actualCost,
          tokensUsed,
          latencyMs,
          success: true,
          fallbackUsed: fallbackFrom !== undefined,
          fallbackFrom,
          timestamp: new Date(),
        });

        incCounter('mmr_complete', 'Multi-model router completions', 1, { model: model.name, strategy: this.policy.strategy });
        observeHistogram('mmr_latency_ms', 'Router latency', latencyMs, undefined, { model: model.name });

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const failures = (this.failureCounts.get(model.name) ?? 0) + 1;
        this.failureCounts.set(model.name, failures);

        log.warn({ model: model.name, failures, err: lastError.message }, 'model failed — trying fallback');
        fallbackFrom = model.name;

        // Record failed trace
        this.recordTrace({
          selectedModel: model.name,
          taskComplexity: this.classifyComplexity(messages, opts),
          taskCategory: this.classifyCategory(messages),
          complexityScore: this.assessComplexityScore(messages),
          estimatedCost: 0,
          actualCost: 0,
          tokensUsed: 0,
          latencyMs: Date.now() - startTime,
          success: false,
          fallbackUsed: false,
          timestamp: new Date(),
        });

        if (!this.policy.fallbackEnabled) throw lastError;
      }
    }

    throw lastError ?? new Error('No models available');
  }

  async *stream(
    messages: LlmMessage[],
    opts?: { maxTokens?: number },
  ): AsyncGenerator<string> {
    const ordered = this.selectModels(messages, opts);

    for (const model of ordered) {
      if (!model.provider.stream) continue;

      try {
        yield* model.provider.stream(messages, opts);
        return;
      } catch (err) {
        log.warn({ model: model.name }, 'stream failed — trying fallback');
      }
    }

    throw new Error('No streaming-capable models available');
  }

  selectForTask(taskComplexity: TaskComplexity): ModelConfig | undefined {
    const capabilityMap: Record<TaskComplexity, string[]> = {
      simple: ['basic', 'standard', 'advanced'],
      medium: ['standard', 'advanced'],
      complex: ['advanced'],
      ultra: ['advanced'],
    };

    const suitable = this.models.filter((m) => {
      const validCaps = capabilityMap[taskComplexity] ?? ['advanced'];
      return validCaps.includes(m.capability) && (this.failureCounts.get(m.name) ?? 0) < 5;
    });

    if (suitable.length === 0) return this.models[0];

    switch (this.policy.strategy) {
      case 'cheapest': return suitable.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0];
      case 'fastest': return suitable.sort((a, b) => this.speedScore(a.speed) - this.speedScore(b.speed))[0];
      case 'smart': {
        // Smart: pick cheapest model that can handle the task
        if (taskComplexity === 'simple') return suitable.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0];
        if (taskComplexity === 'medium') return suitable.filter(m => m.capability !== 'basic').sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0] ?? suitable[0];
        return suitable.sort((a, b) => b.priority - a.priority)[0];
      }
      default: return suitable[0];
    }
  }

  addModel(config: ModelConfig): void {
    this.models.push(config);
    this.models.sort((a, b) => b.priority - a.priority);
  }

  removeModel(name: string): void {
    this.models = this.models.filter((m) => m.name !== name);
  }

  listModels(): Array<{ name: string; capability: string; failures: number }> {
    return this.models.map((m) => ({
      name: m.name,
      capability: m.capability,
      failures: this.failureCounts.get(m.name) ?? 0,
    }));
  }

  getStats(): ProviderRoutingStats {
    const total = this.traces.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        costSavingsVsMaxModel: 0,
        byModel: [],
        byComplexity: [],
        byCategory: [],
        fallbackRate: 0,
        avgLatencyMs: 0,
      };
    }

    const byModelMap = new Map<string, { count: number; tokens: number; cost: number }>();
    const byComplexityMap = new Map<TaskComplexity, number>();
    const byCategoryMap = new Map<TaskCategory, number>();
    let totalTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let fallbackCount = 0;
    let maxModelCost = 0;

    const maxCostModel = this.models.reduce((max, m) => m.costPer1kTokens > max.costPer1kTokens ? m : max, this.models[0]);

    for (const trace of this.traces) {
      const existing = byModelMap.get(trace.selectedModel) ?? { count: 0, tokens: 0, cost: 0 };
      existing.count++;
      existing.tokens += trace.tokensUsed;
      existing.cost += trace.actualCost;
      byModelMap.set(trace.selectedModel, existing);

      byComplexityMap.set(trace.taskComplexity, (byComplexityMap.get(trace.taskComplexity) ?? 0) + 1);
      byCategoryMap.set(trace.taskCategory, (byCategoryMap.get(trace.taskCategory) ?? 0) + 1);

      totalTokens += trace.tokensUsed;
      totalCost += trace.actualCost;
      totalLatency += trace.latencyMs;
      if (trace.fallbackUsed) fallbackCount++;
      maxModelCost += (trace.tokensUsed / 1000) * (maxCostModel?.costPer1kTokens ?? 0);
    }

    return {
      totalRequests: total,
      totalTokensUsed: totalTokens,
      totalCost: Math.round(totalCost * 10000) / 10000,
      costSavingsVsMaxModel: maxModelCost > 0 ? Math.round(((maxModelCost - totalCost) / maxModelCost) * 100) : 0,
      byModel: Array.from(byModelMap.entries()).map(([name, v]) => ({ name, ...v })),
      byComplexity: Array.from(byComplexityMap.entries()).map(([complexity, count]) => ({ complexity, count })),
      byCategory: Array.from(byCategoryMap.entries()).map(([category, count]) => ({ category, count })),
      fallbackRate: Math.round((fallbackCount / total) * 100),
      avgLatencyMs: Math.round(totalLatency / total),
      budgetRemaining: this.getBudgetRemaining(),
    };
  }

  getBudgetRemaining(): { tokens?: number; cost?: number } | undefined {
    if (!this.budget.tokenBudget && !this.budget.costBudget) return undefined;
    return {
      tokens: this.budget.tokenBudget ? Math.max(0, this.budget.tokenBudget - this.budget.tokensUsed) : undefined,
      cost: this.budget.costBudget ? Math.round((this.budget.costBudget - this.budget.costSpent) * 10000) / 10000 : undefined,
    };
  }

  clearTraces(): void {
    this.traces = [];
  }

  private selectModels(
    messages: LlmMessage[],
    opts?: { maxTokens?: number; temperature?: number; tools?: LlmToolDefinition[] },
  ): ModelConfig[] {
    const healthy = this.models.filter((m) => (this.failureCounts.get(m.name) ?? 0) < 5);
    if (healthy.length === 0) return this.models;

    switch (this.policy.strategy) {
      case 'cheapest':
        return [...healthy].sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
      case 'fastest':
        return [...healthy].sort((a, b) => this.speedScore(a.speed) - this.speedScore(b.speed));
      case 'round_robin': {
        const idx = this.roundRobinIndex % healthy.length;
        this.roundRobinIndex++;
        return [healthy[idx], ...healthy.filter((_, i) => i !== idx)];
      }
      case 'smart': {
        const complexity = this.classifyComplexity(messages, opts);
        const category = this.classifyCategory(messages);

        // Find models that match the task category
        const categoryMatched = healthy.filter(m =>
          m.taskCategories?.includes(category) || m.capability === 'advanced'
        );

        const pool = categoryMatched.length > 0 ? categoryMatched : healthy;

        // Sort by best fit: cheapest model that can handle the complexity
        if (complexity === 'simple') {
          return [...pool].sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
        } else if (complexity === 'medium') {
          const capable = pool.filter(m => m.capability !== 'basic');
          const sorted = (capable.length > 0 ? capable : pool).sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
          // Put cheapest capable first, then the rest as fallback
          const remaining = pool.filter(m => !sorted.includes(m));
          return [...sorted, ...remaining];
        } else if (complexity === 'complex' || complexity === 'ultra') {
          const advanced = pool.filter(m => m.capability === 'advanced');
          const sorted = (advanced.length > 0 ? advanced : pool).sort((a, b) => b.priority - a.priority);
          const remaining = pool.filter(m => !sorted.includes(m));
          return [...sorted, ...remaining];
        }
        return pool;
      }
      default:
        return healthy;
    }
  }

  private speedScore(speed: string): number {
    return speed === 'fast' ? 1 : speed === 'medium' ? 2 : 3;
  }

  private classifyComplexity(
    messages: LlmMessage[],
    opts?: { tools?: LlmToolDefinition[] },
  ): TaskComplexity {
    const score = this.assessComplexityScore(messages);

    // Tool calls bump complexity
    if (opts?.tools && opts.tools.length > 10) return 'complex';
    if (opts?.tools && opts.tools.length > 0 && score > 0.3) return 'medium';

    if (score >= 0.75) return 'ultra';
    if (score >= 0.5) return 'complex';
    if (score >= 0.25) return 'medium';
    return 'simple';
  }

  private classifyCategory(messages: LlmMessage[]): TaskCategory {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return 'general';
    const text = lastUser.content.toLowerCase();

    // Pattern matching for task categories
    const patterns: Array<[TaskCategory, RegExp]> = [
      ['classification', /\b(classify|categor|label|tag|sentiment)\b/i],
      ['extraction', /\b(extract|parse|pull|get field|entity)\b/i],
      ['formatting', /\b(format|convert|transform|render|markdown|html)\b/i],
      ['simple-qa', /\b(what is|who is|when is|where is|define|meaning of)\b/i],
      ['summarization', /\b(summari|tldr|brief|condense|abstract)\b/i],
      ['translation', /\b(translat|in (arabic|english|french|spanish|german))\b/i],
      ['coding', /\b(code|function|class|method|bug|fix|implement|refactor|api|endpoint)\b/i],
      ['debugging', /\b(debug|error|stack trace|crash|exception|traceback|fail)\b/i],
      ['architecture', /\b(architect|design pattern|system design|scal|microservice|infrastructure)\b/i],
      ['multi-step-planning', /\b(plan|step|then|after|next|finally|first|second|workflow|pipeline)\b/i],
      ['research', /\b(research|investigat|analyz|study|compar|evaluat)\b/i],
      ['creative', /\b(write|story|poem|creative|generat|brainstorm|idea)\b/i],
      ['agentic', /\b(run|execute|deploy|ssh|server|docker|build|test)\b/i],
      ['reasoning', /\b(why|how come|reason|logic|deduc|infer|conclude)\b/i],
      ['analysis', /\b(analyz|breakdown|assess|evaluat|review|audit|inspect)\b/i],
    ];

    for (const [category, regex] of patterns) {
      if (regex.test(text)) return category;
    }
    return 'general';
  }

  private assessComplexityScore(messages: LlmMessage[]): number {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return 0.5;
    const input = lastUser.content;

    let score = 0;
    score += Math.min(0.3, input.length / 10000);

    const questionMarks = (input.match(/\?/g) ?? []).length;
    score += Math.min(0.1, questionMarks * 0.03);

    const codeBlocks = (input.match(/```/g) ?? []).length / 2;
    score += Math.min(0.15, codeBlocks * 0.05);

    const multiStep = /\b(step|then|after|next|finally|first|second)\b/gi;
    const multiStepCount = (input.match(multiStep) ?? []).length;
    score += Math.min(0.15, multiStepCount * 0.03);

    const complexKeywords = /\b(architect|design|optimize|debug|analyze|refactor|integrate|orchestrat|deploy|scal)\b/gi;
    const complexCount = (input.match(complexKeywords) ?? []).length;
    score += Math.min(0.2, complexCount * 0.05);

    // Conversation length adds complexity
    if (messages.length > 10) score += 0.1;
    if (messages.length > 20) score += 0.1;

    return Math.min(1, score);
  }

  private estimateInputTokens(messages: LlmMessage[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }

  private isBudgetExceeded(): boolean {
    if (this.budget.tokenBudget && this.budget.tokensUsed >= this.budget.tokenBudget) return true;
    if (this.budget.costBudget && this.budget.costSpent >= this.budget.costBudget) return true;
    return false;
  }

  private findCheaperModel(current: ModelConfig): ModelConfig | undefined {
    return this.models
      .filter(m => m.costPer1kTokens < current.costPer1kTokens && (this.failureCounts.get(m.name) ?? 0) < 5)
      .sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0];
  }

  private recordTrace(trace: RoutingTrace): void {
    this.traces.push(trace);
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }
  }
}
