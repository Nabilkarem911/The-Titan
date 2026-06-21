import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'self-rewriter' });

export interface RewriteVersion {
  id: string;
  version: number;
  description: string;
  code: string;
  createdAt: Date;
  performance: number; // 0-100
  applied: boolean;
  rolledBack: boolean;
}

export interface RewriteProposal {
  id: string;
  targetModule: string;
  currentPerformance: number;
  proposedChange: string;
  proposedCode: string;
  expectedImprovement: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RewriteResult {
  proposalId: string;
  accepted: boolean;
  version: number;
  testedInSandbox: boolean;
  sandboxPassed: boolean;
  applied: boolean;
  performanceBefore: number;
  performanceAfter: number;
  improved: boolean;
  rolledBack: boolean;
  reasoning: string;
}

const ANALYSIS_PROMPT = `You are a recursive self-improvement agent. Analyze the agent's recent performance and propose a concrete code improvement.

The agent can rewrite its own logic. Propose changes that:
1. Are minimal — change only what's needed
2. Are testable — can be validated in sandbox
3. Are reversible — can be rolled back if worse
4. Address the biggest performance bottleneck

Respond in JSON:
{
  "targetModule": "which module to improve",
  "proposedChange": "description of the change",
  "proposedCode": "the new code",
  "expectedImprovement": "what will improve",
  "confidence": 0-100,
  "riskLevel": "low" | "medium" | "high"
}`;

const EVALUATION_PROMPT = `You are evaluating whether a self-rewrite improved the agent's performance.

Compare the before and after performance data. Determine:
1. Did performance improve?
2. Should the change be kept or rolled back?
3. What was the key difference?

Respond in JSON:
{
  "improved": true/false,
  "keepChange": true/false,
  "performanceAfter": 0-100,
  "reasoning": "explanation"
}`;

export class SelfRewriter {
  private versions: RewriteVersion[] = [];
  private currentVersion = 0;
  private maxVersions = 50;
  private currentPerformance = 50; // baseline

  constructor(private llm: LlmProvider) {}

  async proposeImprovement(
    recentPerformance: { successRate: number; avgDuration: number; avgTokens: number; errorPatterns: string[] },
  ): Promise<RewriteProposal | null> {
    log.info({ currentPerf: this.currentPerformance }, 'proposing self-rewrite');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: ANALYSIS_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            currentPerformance: this.currentPerformance,
            recentPerformance,
            currentVersion: this.currentVersion,
            pastVersions: this.versions.slice(-5).map((v) => ({
              version: v.version,
              description: v.description,
              performance: v.performance,
              rolledBack: v.rolledBack,
            })),
          }),
        },
      ], { temperature: 0.3, maxTokens: 1000 });

      const parsed = this.parseProposal(response.content);
      if (!parsed) return null;

      incCounter('self_rewrite_proposed', 'Self-rewrite proposals', 1);
      log.info({ target: parsed.targetModule, risk: parsed.riskLevel }, 'rewrite proposed');
      return parsed;
    } catch (err) {
      log.error({ err }, 'failed to propose improvement');
      return null;
    }
  }

  async evaluateAndApply(
    proposal: RewriteProposal,
    sandboxTest?: (code: string) => Promise<{ passed: boolean; score: number }>,
  ): Promise<RewriteResult> {
    const perfBefore = this.currentPerformance;
    let sandboxPassed = false;
    let testedInSandbox = false;

    // Test in sandbox if available
    if (sandboxTest) {
      testedInSandbox = true;
      try {
        const result = await sandboxTest(proposal.proposedCode);
        sandboxPassed = result.passed;
        if (!result.passed) {
          log.warn({ proposalId: proposal.id }, 'sandbox test failed — rejecting rewrite');
          return {
            proposalId: proposal.id,
            accepted: false,
            version: this.currentVersion,
            testedInSandbox: true,
            sandboxPassed: false,
            applied: false,
            performanceBefore: perfBefore,
            performanceAfter: perfBefore,
            improved: false,
            rolledBack: false,
            reasoning: 'Sandbox test failed — change rejected for safety',
          };
        }
      } catch (err) {
        log.error({ err }, 'sandbox test errored');
        return {
          proposalId: proposal.id,
          accepted: false,
          version: this.currentVersion,
          testedInSandbox: true,
          sandboxPassed: false,
          applied: false,
          performanceBefore: perfBefore,
          performanceAfter: perfBefore,
          improved: false,
          rolledBack: false,
          reasoning: `Sandbox test errored: ${err instanceof Error ? err.message : 'unknown'}`,
        };
      }
    }

    // Apply the change
    this.currentVersion++;
    const version: RewriteVersion = {
      id: randomUUID().slice(0, 8),
      version: this.currentVersion,
      description: proposal.proposedChange,
      code: proposal.proposedCode,
      createdAt: new Date(),
      performance: perfBefore,
      applied: true,
      rolledBack: false,
    };
    this.versions.push(version);
    if (this.versions.length > this.maxVersions) {
      this.versions = this.versions.slice(-this.maxVersions);
    }

    // Evaluate improvement via LLM
    const perfAfter = await this.evaluateImprovement(proposal, perfBefore);
    version.performance = perfAfter;

    const improved = perfAfter > perfBefore;
    let rolledBack = false;

    if (!improved) {
      // Rollback
      version.applied = false;
      version.rolledBack = true;
      this.currentVersion--;
      this.currentPerformance = perfBefore;
      rolledBack = true;
      incCounter('self_rewrite_rolled_back', 'Self-rewrite rollbacks', 1);
      log.info({ version: version.version }, 'rewrite rolled back — no improvement');
    } else {
      this.currentPerformance = perfAfter;
      incCounter('self_rewrite_applied', 'Self-rewrite applied', 1);
      log.info({ version: version.version, perfBefore, perfAfter }, 'rewrite applied — improved');
    }

    return {
      proposalId: proposal.id,
      accepted: true,
      version: version.version,
      testedInSandbox,
      sandboxPassed,
      applied: !rolledBack,
      performanceBefore: perfBefore,
      performanceAfter: perfAfter,
      improved,
      rolledBack,
      reasoning: improved
        ? `Performance improved from ${perfBefore} to ${perfAfter}`
        : `Performance did not improve (${perfBefore} → ${perfAfter}) — rolled back`,
    };
  }

  rollback(versionId: string): boolean {
    const version = this.versions.find((v) => v.id === versionId && v.applied);
    if (!version) return false;
    version.applied = false;
    version.rolledBack = true;
    this.currentVersion--;
    this.currentPerformance = version.performance;
    log.info({ versionId, version: version.version }, 'manual rollback');
    return true;
  }

  getVersions(): RewriteVersion[] {
    return this.versions;
  }

  getCurrentVersion(): number {
    return this.currentVersion;
  }

  getCurrentPerformance(): number {
    return this.currentPerformance;
  }

  stats(): {
    totalVersions: number;
    currentVersion: number;
    currentPerformance: number;
    appliedCount: number;
    rolledBackCount: number;
    improvementRate: number;
  } {
    const applied = this.versions.filter((v) => v.applied);
    const rolledBack = this.versions.filter((v) => v.rolledBack);
    return {
      totalVersions: this.versions.length,
      currentVersion: this.currentVersion,
      currentPerformance: this.currentPerformance,
      appliedCount: applied.length,
      rolledBackCount: rolledBack.length,
      improvementRate: this.versions.length > 0
        ? Math.round((applied.length / this.versions.length) * 100)
        : 0,
    };
  }

  private async evaluateImprovement(
    proposal: RewriteProposal,
    perfBefore: number,
  ): Promise<number> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: EVALUATION_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            proposal: proposal.proposedChange,
            expectedImprovement: proposal.expectedImprovement,
            confidence: proposal.confidence,
            performanceBefore: perfBefore,
          }),
        },
      ], { temperature: 0.1, maxTokens: 400 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return perfBefore;
      const raw = JSON.parse(jsonMatch[0]);
      const perfAfter = Math.max(0, Math.min(100, Number(raw.performanceAfter ?? perfBefore)));
      return perfAfter;
    } catch {
      return perfBefore;
    }
  }

  private parseProposal(content: string): RewriteProposal | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const raw = JSON.parse(jsonMatch[0]);
      return {
        id: randomUUID().slice(0, 8),
        targetModule: String(raw.targetModule ?? ''),
        currentPerformance: this.currentPerformance,
        proposedChange: String(raw.proposedChange ?? ''),
        proposedCode: String(raw.proposedCode ?? ''),
        expectedImprovement: String(raw.expectedImprovement ?? ''),
        confidence: Math.max(0, Math.min(100, Number(raw.confidence ?? 50))),
        riskLevel: (raw.riskLevel as 'low' | 'medium' | 'high') ?? 'medium',
      };
    } catch {
      return null;
    }
  }
}
