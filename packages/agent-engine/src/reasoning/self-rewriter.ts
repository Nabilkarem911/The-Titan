import { getLogger } from '@titan/logging';
import { incCounter, setGauge, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { selfRewriterVersions as versionsRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'self-rewriter' });

// ===== Phase 1.1: Source-Level Self-Rewriter (MOSS-inspired) =====
// Full pipeline: diagnosis → planning → implementation → verification → deployment

export type RewritePhase =
  | 'diagnosis'
  | 'planning'
  | 'implementation'
  | 'verification'
  | 'deployment'
  | 'completed'
  | 'failed';

export interface DiagnosisResult {
  bottlenecks: Array<{
    module: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    evidence: string;
  }>;
  rootCause: string;
  recommendedFix: string;
  healthScore: number; // 0-100
}

export interface RewritePlan {
  id: string;
  targetModule: string;
  diagnosisId: string;
  changeDescription: string;
  steps: Array<{
    action: string;
    target: string;
    expectedEffect: string;
  }>;
  riskLevel: 'low' | 'medium' | 'high';
  requiresHumanApproval: boolean;
  estimatedImprovement: number;
}

export interface RewriteVersion {
  id: string;
  version: number;
  description: string;
  code: string;
  createdAt: Date;
  performance: number; // 0-100
  applied: boolean;
  rolledBack: boolean;
  phase: RewritePhase;
  planId?: string;
  diagnosisId?: string;
  healthProbePassed?: boolean;
  deployedAt?: Date;
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

export interface SourceRewritePipeline {
  id: string;
  diagnosis: DiagnosisResult | null;
  plan: RewritePlan | null;
  proposal: RewriteProposal | null;
  result: RewriteResult | null;
  phase: RewritePhase;
  startedAt: Date;
  completedAt?: Date;
}

export interface HealthProbe {
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

export type HealthProbeFn = () => Promise<HealthProbe[]>;
export type SandboxTestFn = (code: string) => Promise<{ passed: boolean; score: number; details?: string }>;
export type HumanApprovalFn = (plan: RewritePlan) => Promise<boolean>;

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

const DIAGNOSIS_PROMPT = `You are a source-level diagnostic agent (MOSS-inspired). Analyze the agent's performance data and diagnose root causes.

Identify:
1. Specific bottlenecks with evidence
2. Root cause of performance issues
3. Recommended fix approach
4. Overall health score (0-100)

Respond in JSON:
{
  "bottlenecks": [{"module": "name", "issue": "description", "severity": "low|medium|high", "evidence": "data"}],
  "rootCause": "primary root cause",
  "recommendedFix": "what to change",
  "healthScore": 0-100
}`;

const PLANNING_PROMPT = `You are a source-level rewrite planner. Given a diagnosis, create a detailed implementation plan.

The plan must:
1. Break the change into discrete steps
2. Specify the target module and exact changes
3. Assess risk level
4. Determine if human approval is needed (high risk = yes)
5. Estimate improvement

Respond in JSON:
{
  "targetModule": "module name",
  "changeDescription": "what will change",
  "steps": [{"action": "what to do", "target": "which code", "expectedEffect": "what improves"}],
  "riskLevel": "low|medium|high",
  "requiresHumanApproval": true/false,
  "estimatedImprovement": 0-100
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
  private pipelines: Map<string, SourceRewritePipeline> = new Map();
  private maxPipelines = 20;

  constructor(private llm: LlmProvider) {}

  // ===== Phase 1.1: Full Source-Level Pipeline (MOSS-inspired) =====
  // diagnosis → planning → implementation → verification → deployment

  async diagnose(
    recentPerformance: { successRate: number; avgDuration: number; avgTokens: number; errorPatterns: string[] },
  ): Promise<DiagnosisResult | null> {
    log.info({ currentPerf: this.currentPerformance }, 'running source-level diagnosis');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: DIAGNOSIS_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            currentPerformance: this.currentPerformance,
            recentPerformance,
            currentVersion: this.currentVersion,
            pastIssues: this.versions.filter(v => v.rolledBack).slice(-5).map(v => ({
              version: v.version,
              description: v.description,
              performance: v.performance,
            })),
          }),
        },
      ], { temperature: 0.2, maxTokens: 800 });

      const parsed = this.parseDiagnosis(response.content);
      if (parsed) {
        incCounter('self_rewrite_diagnosis', 'Self-rewrite diagnoses', 1);
        setGauge('self_rewrite_health_score', 'Agent health score', parsed.healthScore);
        log.info({ rootCause: parsed.rootCause, healthScore: parsed.healthScore, bottlenecks: parsed.bottlenecks.length }, 'diagnosis completed');
      }
      return parsed;
    } catch (err) {
      log.error({ err }, 'diagnosis failed');
      return null;
    }
  }

  async planRewrite(diagnosis: DiagnosisResult): Promise<RewritePlan | null> {
    log.info({ rootCause: diagnosis.rootCause }, 'planning source-level rewrite');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: PLANNING_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            diagnosis,
            currentVersion: this.currentVersion,
            currentPerformance: this.currentPerformance,
          }),
        },
      ], { temperature: 0.3, maxTokens: 800 });

      const parsed = this.parsePlan(response.content, diagnosis);
      if (parsed) {
        incCounter('self_rewrite_plan', 'Self-rewrite plans', 1, { riskLevel: parsed.riskLevel });
        log.info({ target: parsed.targetModule, risk: parsed.riskLevel, steps: parsed.steps.length, needsApproval: parsed.requiresHumanApproval }, 'rewrite plan created');
      }
      return parsed;
    } catch (err) {
      log.error({ err }, 'planning failed');
      return null;
    }
  }

  async runFullPipeline(
    recentPerformance: { successRate: number; avgDuration: number; avgTokens: number; errorPatterns: string[] },
    options?: {
      sandboxTest?: SandboxTestFn;
      healthProbe?: HealthProbeFn;
      humanApproval?: HumanApprovalFn;
    },
  ): Promise<SourceRewritePipeline> {
    const pipelineId = randomUUID().slice(0, 8);
    const pipeline: SourceRewritePipeline = {
      id: pipelineId,
      diagnosis: null,
      plan: null,
      proposal: null,
      result: null,
      phase: 'diagnosis',
      startedAt: new Date(),
    };
    this.pipelines.set(pipelineId, pipeline);
    if (this.pipelines.size > this.maxPipelines) {
      const oldest = Array.from(this.pipelines.keys())[0];
      this.pipelines.delete(oldest);
    }

    const pipelineStart = Date.now();

    // Phase 1: Diagnosis
    pipeline.diagnosis = await this.diagnose(recentPerformance);
    if (!pipeline.diagnosis) {
      pipeline.phase = 'failed';
      pipeline.completedAt = new Date();
      incCounter('self_rewrite_pipeline_failed', 'Self-rewrite pipeline failures', 1, { phase: 'diagnosis' });
      return pipeline;
    }

    // Phase 2: Planning
    pipeline.phase = 'planning';
    pipeline.plan = await this.planRewrite(pipeline.diagnosis);
    if (!pipeline.plan) {
      pipeline.phase = 'failed';
      pipeline.completedAt = new Date();
      incCounter('self_rewrite_pipeline_failed', 'Self-rewrite pipeline failures', 1, { phase: 'planning' });
      return pipeline;
    }

    // Human approval gate for high-risk changes
    if (pipeline.plan.requiresHumanApproval && options?.humanApproval) {
      const approved = await options.humanApproval(pipeline.plan);
      if (!approved) {
        pipeline.phase = 'failed';
        pipeline.completedAt = new Date();
        log.info({ pipelineId }, 'pipeline rejected by human approval gate');
        incCounter('self_rewrite_pipeline_rejected', 'Self-rewrite pipeline rejections', 1);
        return pipeline;
      }
    }

    // Phase 3: Implementation (generate proposal from plan)
    pipeline.phase = 'implementation';
    pipeline.proposal = await this.proposeFromPlan(pipeline.plan);
    if (!pipeline.proposal) {
      pipeline.phase = 'failed';
      pipeline.completedAt = new Date();
      incCounter('self_rewrite_pipeline_failed', 'Self-rewrite pipeline failures', 1, { phase: 'implementation' });
      return pipeline;
    }

    // Phase 4: Verification (sandbox test + health probe)
    pipeline.phase = 'verification';
    let sandboxPassed = true;
    if (options?.sandboxTest) {
      try {
        const result = await options.sandboxTest(pipeline.proposal.proposedCode);
        sandboxPassed = result.passed;
        if (!sandboxPassed) {
          pipeline.phase = 'failed';
          pipeline.completedAt = new Date();
          log.warn({ pipelineId }, 'sandbox test failed — pipeline aborted');
          incCounter('self_rewrite_pipeline_failed', 'Self-rewrite pipeline failures', 1, { phase: 'verification' });
          return pipeline;
        }
      } catch (err) {
        pipeline.phase = 'failed';
        pipeline.completedAt = new Date();
        log.error({ err }, 'sandbox test errored');
        incCounter('self_rewrite_pipeline_failed', 'Self-rewrite pipeline failures', 1, { phase: 'verification' });
        return pipeline;
      }
    }

    // Phase 5: Deployment (apply + health probe)
    pipeline.phase = 'deployment';
    pipeline.result = await this.evaluateAndApply(
      pipeline.proposal,
      options?.sandboxTest as ((code: string) => Promise<{ passed: boolean; score: number }>) | undefined,
    );

    // Run health probe after deployment
    if (pipeline.result.applied && options?.healthProbe) {
      try {
        const probes = await options.healthProbe();
        const allPassed = probes.every(p => p.passed);
        const version = this.versions[this.versions.length - 1];
        if (version) {
          version.healthProbePassed = allPassed;
          version.deployedAt = new Date();
        }
        if (!allPassed) {
          // Auto-rollback if health probe fails
          log.warn({ pipelineId, failedProbes: probes.filter(p => !p.passed).map(p => p.name) }, 'health probe failed — auto-rollback');
          if (version) {
            this.rollback(version.id);
            pipeline.result.applied = false;
            pipeline.result.rolledBack = true;
            pipeline.result.reasoning = 'Health probe failed — auto-rollback';
          }
          incCounter('self_rewrite_health_probe_failed', 'Health probe failures', 1);
        } else {
          incCounter('self_rewrite_health_probe_passed', 'Health probe passes', 1);
        }
      } catch (err) {
        log.error({ err }, 'health probe errored');
      }
    }

    pipeline.phase = pipeline.result.applied ? 'completed' : 'failed';
    pipeline.completedAt = new Date();
    observeHistogram('self_rewrite_pipeline_duration_ms', 'Pipeline duration', Date.now() - pipelineStart);
    incCounter('self_rewrite_pipeline_completed', 'Self-rewrite pipeline completions', 1, { result: pipeline.phase });

    return pipeline;
  }

  getPipeline(id: string): SourceRewritePipeline | undefined {
    return this.pipelines.get(id);
  }

  listPipelines(): SourceRewritePipeline[] {
    return Array.from(this.pipelines.values()).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  private async proposeFromPlan(plan: RewritePlan): Promise<RewriteProposal | null> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: ANALYSIS_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            plan,
            currentPerformance: this.currentPerformance,
            currentVersion: this.currentVersion,
          }),
        },
      ], { temperature: 0.3, maxTokens: 1000 });
      return this.parseProposal(response.content);
    } catch (err) {
      log.error({ err }, 'proposeFromPlan failed');
      return null;
    }
  }

  private parseDiagnosis(content: string): DiagnosisResult | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const raw = JSON.parse(jsonMatch[0]);
      return {
        bottlenecks: Array.isArray(raw.bottlenecks) ? raw.bottlenecks.map((b: Record<string, unknown>) => ({
          module: String(b.module ?? ''),
          issue: String(b.issue ?? ''),
          severity: (b.severity as 'low' | 'medium' | 'high') ?? 'medium',
          evidence: String(b.evidence ?? ''),
        })) : [],
        rootCause: String(raw.rootCause ?? ''),
        recommendedFix: String(raw.recommendedFix ?? ''),
        healthScore: Math.max(0, Math.min(100, Number(raw.healthScore ?? 50))),
      };
    } catch {
      return null;
    }
  }

  private parsePlan(content: string, diagnosis: DiagnosisResult): RewritePlan | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const raw = JSON.parse(jsonMatch[0]);
      const riskLevel = (raw.riskLevel as 'low' | 'medium' | 'high') ?? 'medium';
      return {
        id: randomUUID().slice(0, 8),
        targetModule: String(raw.targetModule ?? ''),
        diagnosisId: diagnosis.rootCause.slice(0, 32),
        changeDescription: String(raw.changeDescription ?? ''),
        steps: Array.isArray(raw.steps) ? raw.steps.map((s: Record<string, unknown>) => ({
          action: String(s.action ?? ''),
          target: String(s.target ?? ''),
          expectedEffect: String(s.expectedEffect ?? ''),
        })) : [],
        riskLevel,
        requiresHumanApproval: raw.requiresHumanApproval === true || riskLevel === 'high',
        estimatedImprovement: Math.max(0, Math.min(100, Number(raw.estimatedImprovement ?? 10))),
      };
    } catch {
      return null;
    }
  }

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

    // Apply the change to the target module file
    this.currentVersion++;
    let originalFileContent: string | null = null;
    let targetFilePath: string | null = null;

    if (proposal.targetModule) {
      const candidates = [
        join(process.cwd(), 'packages', 'agent-engine', 'src', ...proposal.targetModule.split('/')) + '.ts',
        join(process.cwd(), 'packages', 'agent-engine', 'src', ...proposal.targetModule.split('/'), 'index.ts'),
        join(process.cwd(), proposal.targetModule),
      ];
      for (const candidate of candidates) {
        try {
          originalFileContent = await readFile(candidate, 'utf-8');
          targetFilePath = candidate;
          break;
        } catch {
          // try next candidate
        }
      }
    }

    if (targetFilePath && originalFileContent !== null && proposal.proposedCode) {
      try {
        await writeFile(targetFilePath, proposal.proposedCode, 'utf-8');
        log.info({ version: this.currentVersion, file: targetFilePath }, 'rewrite applied to file');
      } catch (writeErr) {
        log.warn({ err: writeErr, file: targetFilePath }, 'failed to write rewritten file — continuing in memory only');
        targetFilePath = null;
      }
    }

    const version: RewriteVersion = {
      id: randomUUID().slice(0, 8),
      version: this.currentVersion,
      description: proposal.proposedChange,
      code: proposal.proposedCode,
      createdAt: new Date(),
      performance: perfBefore,
      applied: true,
      rolledBack: false,
      phase: 'deployment',
    };
    this.versions.push(version);
    if (this.versions.length > this.maxVersions) {
      this.versions = this.versions.slice(-this.maxVersions);
    }

    versionsRepo.insert({
      id: version.id,
      version: version.version,
      description: version.description,
      code: version.code ?? null,
      applied: version.applied,
      rolledBack: version.rolledBack,
      phase: version.phase,
      performance: version.performance,
      createdAt: version.createdAt,
    }).catch((err) => log.warn({ err, id: version.id }, 'failed to persist rewrite version'));

    // Evaluate improvement via LLM
    const perfAfter = await this.evaluateImprovement(proposal, perfBefore);
    version.performance = perfAfter;

    const improved = perfAfter > perfBefore;
    let rolledBack = false;

    if (!improved) {
      // Rollback — restore original file content
      if (targetFilePath && originalFileContent !== null) {
        try {
          await writeFile(targetFilePath, originalFileContent, 'utf-8');
          log.info({ version: version.version, file: targetFilePath }, 'file rolled back to original');
        } catch (rollbackErr) {
          log.error({ err: rollbackErr, file: targetFilePath }, 'FAILED to rollback file — manual intervention needed');
        }
      }
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
