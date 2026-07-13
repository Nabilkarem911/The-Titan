import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { neuroSymbolicResults as nsrRepo, neuroSymbolicRules as nsRulesRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'neuro-symbolic' });

export interface SymbolicRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  priority: number;
  active: boolean;
  createdAt: Date;
  timesApplied: number;
}

export interface NeuralPrediction {
  symbol: string;
  confidence: number;
  reasoning: string;
}

export interface NeuroSymbolicResult {
  id: string;
  query: string;
  neuralPredictions: NeuralPrediction[];
  symbolicRulesApplied: SymbolicRule[];
  synthesizedConclusion: string;
  confidence: number;
  reasoning: string;
  neuralOnly: boolean;
  symbolicOnly: boolean;
  hybrid: boolean;
  createdAt: Date;
}

const NEURAL_PROMPT = `You are a neural reasoning module. Given a query, generate intuitive predictions about the answer.

Provide multiple predictions with confidence scores. Think of this as the "fast" neural pathway — pattern matching and intuition.

Respond in JSON:
{
  "predictions": [
    { "symbol": "prediction text", "confidence": 0-1, "reasoning": "why" }
  ]
}`;

const SYMBOLIC_PROMPT = `You are a symbolic reasoning module. Given a query and a set of rules, apply formal logic to derive conclusions.

Available rules:
{rules}

Apply any matching rules and derive conclusions through formal logical steps.

Respond in JSON:
{
  "conclusions": [
    { "ruleName": "which rule", "conclusion": "what was derived", "steps": "logical steps" }
  ]
}`;

const SYNTHESIS_PROMPT = `You are a neuro-symbolic synthesis module. Combine neural predictions (intuitive) with symbolic conclusions (logical) into a final answer.

If neural and symbolic agree, confidence is high.
If they disagree, note the conflict and choose the more reliable path.

Respond in JSON:
{
  "conclusion": "the final answer",
  "confidence": 0-1,
  "reasoning": "how neural and symbolic were combined",
  "hybrid": true/false
}`;

export class NeuroSymbolicReasoner {
  private rules: SymbolicRule[] = [];
  private results: NeuroSymbolicResult[] = [];
  private maxResults = 200;
  private maxRules = 100;

  constructor(private llm: LlmProvider) {
    this.seedDefaultRules();
  }

  async reason(query: string): Promise<NeuroSymbolicResult> {
    log.info({ query: query.slice(0, 80) }, 'neuro-symbolic reasoning started');
    const startedAt = Date.now();

    try {
      // Phase 1: Neural — intuitive predictions
      const neuralPredictions = await this.neuralPathway(query);

      // Phase 2: Symbolic — rule-based logic
      const symbolicResults = await this.symbolicPathway(query);

      // Phase 3: Synthesis — combine both
      const synthesis = await this.synthesize(query, neuralPredictions, symbolicResults);

      const result: NeuroSymbolicResult = {
        id: randomUUID().slice(0, 8),
        query,
        neuralPredictions,
        symbolicRulesApplied: symbolicResults,
        synthesizedConclusion: synthesis.conclusion,
        confidence: synthesis.confidence,
        reasoning: synthesis.reasoning,
        neuralOnly: neuralPredictions.length > 0 && symbolicResults.length === 0,
        symbolicOnly: neuralPredictions.length === 0 && symbolicResults.length > 0,
        hybrid: synthesis.hybrid,
        createdAt: new Date(),
      };

      // Track rule applications
      for (const rule of symbolicResults) {
        rule.timesApplied++;
      }

      this.results.push(result);
      if (this.results.length > this.maxResults) {
        this.results = this.results.slice(-this.maxResults);
      }
      nsrRepo.insert(result.id, { query: result.query, approach: result.hybrid ? 'hybrid' : (result.neuralOnly ? 'neural' : 'symbolic'), result: result.synthesizedConclusion, confidence: result.confidence, rules_used: result.symbolicRulesApplied.map(r => r.name) }).catch((err) => log.error({ err }, 'DB write failed'));

      incCounter('neuro_symbolic_run', 'Neuro-symbolic reasoning runs', 1, {
        hybrid: result.hybrid ? 'true' : 'false',
      });

      log.info(
        {
          neural: neuralPredictions.length,
          symbolic: symbolicResults.length,
          hybrid: result.hybrid,
          confidence: result.confidence,
          durationMs: Date.now() - startedAt,
        },
        'neuro-symbolic reasoning complete',
      );

      return result;
    } catch (err) {
      log.error({ err }, 'neuro-symbolic reasoning failed');
      return {
        id: randomUUID().slice(0, 8),
        query,
        neuralPredictions: [],
        symbolicRulesApplied: [],
        synthesizedConclusion: 'Reasoning failed',
        confidence: 0,
        reasoning: err instanceof Error ? err.message : 'unknown error',
        neuralOnly: false,
        symbolicOnly: false,
        hybrid: false,
        createdAt: new Date(),
      };
    }
  }

  addRule(rule: Omit<SymbolicRule, 'id' | 'createdAt' | 'timesApplied'>): SymbolicRule {
    const fullRule: SymbolicRule = {
      ...rule,
      id: randomUUID().slice(0, 8),
      createdAt: new Date(),
      timesApplied: 0,
    };
    this.rules.push(fullRule);
    nsRulesRepo.insert(fullRule.id, fullRule.name, fullRule.condition, fullRule.action, fullRule.priority).catch((err) => log.error({ err }, 'DB write failed'));
    if (this.rules.length > this.maxRules) {
      this.rules = this.rules.slice(-this.maxRules);
    }
    log.info({ ruleName: rule.name }, 'symbolic rule added');
    return fullRule;
  }

  removeRule(id: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.rules.splice(idx, 1);
    return true;
  }

  toggleRule(id: string): boolean {
    const rule = this.rules.find((r) => r.id === id);
    if (!rule) return false;
    rule.active = !rule.active;
    return true;
  }

  getRules(): SymbolicRule[] {
    return this.rules;
  }

  getActiveRules(): SymbolicRule[] {
    return this.rules.filter((r) => r.active);
  }

  getResults(): NeuroSymbolicResult[] {
    return this.results;
  }

  stats(): {
    totalResults: number;
    totalRules: number;
    activeRules: number;
    hybridCount: number;
    neuralOnlyCount: number;
    symbolicOnlyCount: number;
    avgConfidence: number;
  } {
    const total = this.results.length;
    return {
      totalResults: total,
      totalRules: this.rules.length,
      activeRules: this.rules.filter((r) => r.active).length,
      hybridCount: this.results.filter((r) => r.hybrid).length,
      neuralOnlyCount: this.results.filter((r) => r.neuralOnly).length,
      symbolicOnlyCount: this.results.filter((r) => r.symbolicOnly).length,
      avgConfidence: total > 0
        ? Math.round((this.results.reduce((s, r) => s + r.confidence, 0) / total) * 100) / 100
        : 0,
    };
  }

  clear(): void {
    this.results = [];
  }

  private async neuralPathway(query: string): Promise<NeuralPrediction[]> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: NEURAL_PROMPT },
        { role: 'user', content: query },
      ], { temperature: 0.5, maxTokens: 500 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      const raw = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(raw.predictions)) return [];

      return raw.predictions.map((p: Record<string, unknown>) => ({
        symbol: String(p.symbol ?? ''),
        confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0.5))),
        reasoning: String(p.reasoning ?? ''),
      }));
    } catch {
      return [];
    }
  }

  private async symbolicPathway(query: string): Promise<SymbolicRule[]> {
    const activeRules = this.getActiveRules();
    if (activeRules.length === 0) return [];

    try {
      const rulesText = activeRules
        .map((r) => `- ${r.name}: IF ${r.condition} THEN ${r.action} (priority: ${r.priority})`)
        .join('\n');

      const response = await this.llm.complete([
        { role: 'system', content: SYMBOLIC_PROMPT.replace('{rules}', rulesText) },
        { role: 'user', content: query },
      ], { temperature: 0.1, maxTokens: 500 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      const raw = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(raw.conclusions)) return [];

      const appliedRuleNames = raw.conclusions.map((c: Record<string, unknown>) => String(c.ruleName ?? ''));
      return activeRules.filter((r) => appliedRuleNames.some((n: string) => n.includes(r.name)));
    } catch {
      return [];
    }
  }

  private async synthesize(
    query: string,
    neural: NeuralPrediction[],
    symbolic: SymbolicRule[],
  ): Promise<{ conclusion: string; confidence: number; reasoning: string; hybrid: boolean }> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: SYNTHESIS_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            query,
            neuralPredictions: neural.map((n) => ({ symbol: n.symbol, confidence: n.confidence })),
            symbolicConclusions: symbolic.map((s) => ({ rule: s.name, action: s.action })),
          }),
        },
      ], { temperature: 0.2, maxTokens: 400 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { conclusion: 'Synthesis failed', confidence: 0.3, reasoning: 'parse error', hybrid: false };
      const raw = JSON.parse(jsonMatch[0]);
      return {
        conclusion: String(raw.conclusion ?? ''),
        confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5))),
        reasoning: String(raw.reasoning ?? ''),
        hybrid: Boolean(raw.hybrid ?? (neural.length > 0 && symbolic.length > 0)),
      };
    } catch {
      return {
        conclusion: neural[0]?.symbol ?? 'No conclusion',
        confidence: neural[0]?.confidence ?? 0.3,
        reasoning: 'Fallback to neural only',
        hybrid: false,
      };
    }
  }

  private seedDefaultRules(): void {
    const defaults: Array<Omit<SymbolicRule, 'id' | 'createdAt' | 'timesApplied'>> = [
      {
        name: 'error-implies-failure',
        condition: 'observation.error is not null',
        action: 'mark step as failed and attempt recovery',
        priority: 10,
        active: true,
      },
      {
        name: 'low-confidence-implies-reflection',
        condition: 'confidence < 0.5',
        action: 'trigger self-reflection before proceeding',
        priority: 8,
        active: true,
      },
      {
        name: 'repeated-tool-implies-stuck',
        condition: 'same tool called 3+ times consecutively',
        action: 'switch strategy or ask for clarification',
        priority: 9,
        active: true,
      },
      {
        name: 'success-implies-continue',
        condition: 'observation.success is true and plan has remaining steps',
        action: 'proceed to next step',
        priority: 5,
        active: true,
      },
    ];

    for (const rule of defaults) {
      const fullRule = {
        ...rule,
        id: randomUUID().slice(0, 8),
        createdAt: new Date(),
        timesApplied: 0,
      };
      this.rules.push(fullRule);
      nsRulesRepo.insert(fullRule.id, fullRule.name, fullRule.condition, fullRule.action, fullRule.priority).catch((err) => log.error({ err }, 'DB write failed'));
    }
  }
}
