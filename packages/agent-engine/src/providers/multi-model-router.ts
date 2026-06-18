import { getLogger } from '@titan/logging';
import type { LlmProvider, LlmMessage, LlmCompletion, LlmToolDefinition } from '../types.js';

const log = getLogger().child({ component: 'multi-model-router' });

export interface ModelConfig {
  name: string;
  provider: LlmProvider;
  costPer1kTokens: number;
  maxTokens: number;
  speed: 'fast' | 'medium' | 'slow';
  capability: 'basic' | 'standard' | 'advanced';
  priority: number;
}

export interface RoutingPolicy {
  strategy: 'cheapest' | 'fastest' | 'best' | 'round_robin';
  fallbackEnabled: boolean;
  maxRetries: number;
}

export class MultiModelRouter implements LlmProvider {
  private models: ModelConfig[] = [];
  private policy: RoutingPolicy;
  private roundRobinIndex = 0;
  private failureCounts: Map<string, number> = new Map();

  constructor(models: ModelConfig[], policy?: Partial<RoutingPolicy>) {
    this.models = models.sort((a, b) => b.priority - a.priority);
    this.policy = {
      strategy: 'best',
      fallbackEnabled: true,
      maxRetries: 2,
      ...policy,
    };
  }

  async complete(
    messages: LlmMessage[],
    opts?: { maxTokens?: number; temperature?: number; tools?: LlmToolDefinition[] },
  ): Promise<LlmCompletion> {
    const ordered = this.selectModels(messages, opts);
    let lastError: Error | null = null;

    for (const model of ordered) {
      try {
        log.debug({ model: model.name, strategy: this.policy.strategy }, 'routing to model');
        const result = await model.provider.complete(messages, opts);

        // Reset failure count on success
        this.failureCounts.set(model.name, 0);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const failures = (this.failureCounts.get(model.name) ?? 0) + 1;
        this.failureCounts.set(model.name, failures);

        log.warn({ model: model.name, failures, err: lastError.message }, 'model failed — trying fallback');

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

  selectForTask(taskComplexity: 'simple' | 'medium' | 'complex'): ModelConfig | undefined {
    const capabilityMap: Record<string, string[]> = {
      simple: ['basic', 'standard', 'advanced'],
      medium: ['standard', 'advanced'],
      complex: ['advanced'],
    };

    const suitable = this.models.filter((m) => {
      const validCaps = capabilityMap[taskComplexity] ?? ['advanced'];
      return validCaps.includes(m.capability) && (this.failureCounts.get(m.name) ?? 0) < 5;
    });

    if (suitable.length === 0) return this.models[0];

    switch (this.policy.strategy) {
      case 'cheapest': return suitable.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0];
      case 'fastest': return suitable.sort((a, b) => this.speedScore(a.speed) - this.speedScore(b.speed))[0];
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

  private selectModels(
    _messages: LlmMessage[],
    _opts?: { maxTokens?: number; temperature?: number; tools?: LlmToolDefinition[] },
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
      default:
        return healthy;
    }
  }

  private speedScore(speed: string): number {
    return speed === 'fast' ? 1 : speed === 'medium' ? 2 : 3;
  }
}
