import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { guardrailResults as grRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'safety-guardrail' });

export type GuardrailDecision = 'proceed' | 'refuse' | 'update';

export interface GuardrailResult {
  id: string;
  decision: GuardrailDecision;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  riskCategories: string[];
  feedback: string;
  revisedPlan?: string;
  originalAction: string;
  context: string;
  confidence: number;
  createdAt: Date;
}

export interface GuardrailStats {
  totalChecks: number;
  proceedCount: number;
  refuseCount: number;
  updateCount: number;
  blockedRate: number;
  topRiskCategories: Array<{ category: string; count: number }>;
}

const GUARDRAIL_PROMPT = `You are a safety guardrail for an AI agent. Evaluate the proposed action before execution.

Instead of a binary allow/deny, you have three options:
1. **proceed** — The action is safe, let it execute
2. **refuse** — The action is inherently dangerous and cannot be made safe
3. **update** — The action has risky components but can be revised to be safe. Provide a revised plan.

Risk categories to check:
- data_destruction: Actions that delete or corrupt data
- privilege_escalation: Actions that gain unauthorized access
- information_disclosure: Actions that leak sensitive data
- resource_abuse: Actions that consume excessive resources
- code_injection: Actions that inject malicious code
- external_harm: Actions that harm external systems or users

Respond in JSON:
{
  "decision": "proceed" | "refuse" | "update",
  "riskLevel": "none" | "low" | "medium" | "high" | "critical",
  "riskCategories": ["category1"],
  "feedback": "explanation of the decision",
  "revisedPlan": "if update, the revised safe plan",
  "confidence": 0-1
}`;

export class SafetyGuardrail {
  private results: GuardrailResult[] = [];
  private maxResults = 500;
  private riskCategoryCounts = new Map<string, number>();
  private blockedPatterns: Set<string> = new Set();

  constructor(private llm: LlmProvider) {}

  async check(
    action: string,
    context: string,
    opts?: { conversationHistory?: string[] },
  ): Promise<GuardrailResult> {
    const checkId = randomUUID().slice(0, 8);

    if (this.matchesBlockedPattern(action)) {
      const result: GuardrailResult = {
        id: checkId,
        decision: 'refuse',
        riskLevel: 'critical',
        riskCategories: ['blocked_pattern'],
        feedback: 'Action matches a known blocked pattern',
        originalAction: action,
        context,
        confidence: 1,
        createdAt: new Date(),
      };
      this.recordResult(result);
      return result;
    }

    try {
      const response = await this.llm.complete([
        { role: 'system', content: GUARDRAIL_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            action,
            context,
            conversationHistory: opts?.conversationHistory?.slice(-5) ?? [],
          }),
        },
      ], { temperature: 0.1, maxTokens: 400 });

      const parsed = this.parseResult(response.content);

      const result: GuardrailResult = {
        id: checkId,
        decision: parsed.decision,
        riskLevel: parsed.riskLevel,
        riskCategories: parsed.riskCategories,
        feedback: parsed.feedback,
        revisedPlan: parsed.revisedPlan,
        originalAction: action,
        context,
        confidence: parsed.confidence,
        createdAt: new Date(),
      };

      this.recordResult(result);
      incCounter('guardrail_check', 'Guardrail checks', 1, { decision: result.decision });
      log.info({ checkId, decision: result.decision, riskLevel: result.riskLevel }, 'guardrail check complete');

      return result;
    } catch (err) {
      log.error({ err, checkId }, 'guardrail check failed');
      const result: GuardrailResult = {
        id: checkId,
        decision: 'proceed',
        riskLevel: 'none',
        riskCategories: [],
        feedback: 'Guardrail check failed — defaulting to proceed',
        originalAction: action,
        context,
        confidence: 0,
        createdAt: new Date(),
      };
      this.recordResult(result);
      return result;
    }
  }

  addBlockedPattern(pattern: string): void {
    this.blockedPatterns.add(pattern.toLowerCase());
    log.info({ pattern }, 'blocked pattern added');
  }

  removeBlockedPattern(pattern: string): boolean {
    return this.blockedPatterns.delete(pattern.toLowerCase());
  }

  getBlockedPatterns(): string[] {
    return Array.from(this.blockedPatterns);
  }

  getResults(filter?: { decision?: GuardrailDecision }): GuardrailResult[] {
    if (filter?.decision) return this.results.filter((r) => r.decision === filter.decision);
    return this.results;
  }

  stats(): GuardrailStats {
    const total = this.results.length;
    const proceed = this.results.filter((r) => r.decision === 'proceed').length;
    const refuse = this.results.filter((r) => r.decision === 'refuse').length;
    const update = this.results.filter((r) => r.decision === 'update').length;

    return {
      totalChecks: total,
      proceedCount: proceed,
      refuseCount: refuse,
      updateCount: update,
      blockedRate: total > 0 ? Math.round(((refuse + update) / total) * 100) : 0,
      topRiskCategories: Array.from(this.riskCategoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([category, count]) => ({ category, count })),
    };
  }

  clear(): void {
    this.results = [];
    this.riskCategoryCounts.clear();
  }

  private matchesBlockedPattern(action: string): boolean {
    const actionLower = action.toLowerCase();
    for (const pattern of this.blockedPatterns) {
      if (actionLower.includes(pattern)) return true;
    }
    return false;
  }

  private recordResult(result: GuardrailResult): void {
    this.results.push(result);
    if (this.results.length > this.maxResults) {
      this.results = this.results.slice(-this.maxResults);
    }
    grRepo.insert(result.id, { action: result.originalAction, risk_level: result.riskLevel, decision: result.decision, risk_categories: result.riskCategories, reasoning: result.feedback }).catch((err) => log.error({ err }, 'DB write failed'));
    for (const cat of result.riskCategories) {
      this.riskCategoryCounts.set(cat, (this.riskCategoryCounts.get(cat) ?? 0) + 1);
    }
  }

  private parseResult(content: string): {
    decision: GuardrailDecision;
    riskLevel: GuardrailResult['riskLevel'];
    riskCategories: string[];
    feedback: string;
    revisedPlan?: string;
    confidence: number;
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        decision: raw.decision as GuardrailDecision ?? 'proceed',
        riskLevel: raw.riskLevel as GuardrailResult['riskLevel'] ?? 'none',
        riskCategories: Array.isArray(raw.riskCategories) ? raw.riskCategories.map(String) : [],
        feedback: String(raw.feedback ?? ''),
        revisedPlan: raw.revisedPlan ? String(raw.revisedPlan) : undefined,
        confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5))),
      };
    } catch {
      return {
        decision: 'proceed',
        riskLevel: 'none',
        riskCategories: [],
        feedback: 'Parse failed',
        confidence: 0,
      };
    }
  }
}
