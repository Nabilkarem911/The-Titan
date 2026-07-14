import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'self-evolving-code' });

interface CodeImprovement {
  id: string;
  filePath: string;
  description: string;
  diff: string;
  reasoning: string;
  fitnessBefore: FitnessScore;
  fitnessAfter: FitnessScore | null;
  status: 'proposed' | 'testing' | 'applied' | 'rejected' | 'rolled_back';
  timestamp: Date;
  commitHash?: string;
}

export interface FitnessScore {
  testPassRate: number;
  executionSpeedMs: number;
  tokenUsage: number;
  codeCoverage: number;
  overall: number;
}

interface EvolutionArchiveEntry {
  id: string;
  improvement: CodeImprovement;
  appliedAt: Date;
  fitnessDelta: number;
  commitHash: string;
}

interface EvolutionConfig {
  maxCyclesPerDay: number;
  degradationThreshold: number;
  safetyCriticalFiles: string[];
  neverModify: string[];
  scheduleHour: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: EvolutionConfig = {
  maxCyclesPerDay: 1,
  degradationThreshold: 0.05,
  safetyCriticalFiles: [
    '**/guardrails/**',
    '**/auth/**',
    '**/security/**',
    '**/middleware/security*',
  ],
  neverModify: [
    'package.json',
    'tsconfig.json',
    '.env',
    '.env.*',
  ],
  scheduleHour: 3,
  enabled: false,
};

const ANALYSIS_PROMPT = `You are a code improvement analyzer. Read the source code and identify 1-3 improvement opportunities.

For each improvement, provide:
1. filePath: which file to improve
2. description: what to improve
3. reasoning: why this improves the code
4. diff: the proposed change (unified diff format)

Focus on: performance, clarity, bug risks, token usage, test coverage.

Respond in JSON:
{
  "improvements": [
    {
      "filePath": "path/to/file.ts",
      "description": "what to improve",
      "reasoning": "why",
      "diff": "proposed diff"
    }
  ]
}`;

export class SelfEvolvingCode {
  private llm: LlmProvider;
  private config: EvolutionConfig;
  private archive: EvolutionArchiveEntry[] = [];
  private cyclesToday = 0;
  private lastCycleDate: string | null = null;

  constructor(llm: LlmProvider, config?: Partial<EvolutionConfig>) {
    this.llm = llm;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  enable(): void {
    this.config.enabled = true;
    log.info('self-evolving code enabled');
  }

  disable(): void {
    this.config.enabled = false;
    log.info('self-evolving code disabled');
  }

  isSafeToModify(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');

    for (const pattern of this.config.neverModify) {
      const regex = this.globToRegex(pattern);
      if (regex.test(normalized)) {
        log.warn({ filePath, pattern }, 'file is in never-modify list');
        return false;
      }
    }

    for (const pattern of this.config.safetyCriticalFiles) {
      const regex = this.globToRegex(pattern);
      if (regex.test(normalized)) {
        log.warn({ filePath, pattern }, 'file is safety-critical — requires human approval');
        return false;
      }
    }

    return true;
  }

  async analyzeModule(
    filePath: string,
    sourceCode: string,
  ): Promise<CodeImprovement[]> {
    if (!this.config.enabled) return [];

    incCounter('evolution_analyses', 'Code evolution analyses', 1);

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: ANALYSIS_PROMPT },
        {
          role: 'user',
          content: `File: ${filePath}\n\nSource code:\n${sourceCode.slice(0, 8000)}`,
        },
      ], { temperature: 0.2, maxTokens: 2000 });

      const improvements = this.parseImprovements(completion.content, filePath);

      // Filter out unsafe modifications
      const safe = improvements.filter((imp) => this.isSafeToModify(imp.filePath));

      log.info({
        filePath,
        proposed: improvements.length,
        safe: safe.length,
      }, 'module analyzed for improvements');

      return safe;
    } catch (err) {
      log.error({ err, filePath }, 'module analysis failed');
      return [];
    }
  }

  async evaluateFitness(
    testPassRate: number,
    executionSpeedMs: number,
    tokenUsage: number,
    codeCoverage: number,
  ): Promise<FitnessScore> {
    const overall = this.calculateOverallFitness({
      testPassRate,
      executionSpeedMs,
      tokenUsage,
      codeCoverage,
    });

    const score: FitnessScore = {
      testPassRate,
      executionSpeedMs,
      tokenUsage,
      codeCoverage,
      overall,
    };

    observeHistogram('evolution_fitness_score', 'Evolution fitness scores', overall);
    return score;
  }

  shouldApply(before: FitnessScore, after: FitnessScore): boolean {
    const delta = after.overall - before.overall;

    if (delta < -this.config.degradationThreshold) {
      log.warn({ delta, threshold: this.config.degradationThreshold }, 'fitness degraded — rejecting');
      incCounter('evolution_rejected', 'Evolution improvements rejected', 1);
      return false;
    }

    incCounter('evolution_applied', 'Evolution improvements applied', 1);
    return true;
  }

  shouldRollback(before: FitnessScore, after: FitnessScore): boolean {
    const delta = before.overall - after.overall;
    return delta > this.config.degradationThreshold;
  }

  async runEvolutionCycle(
    filePath: string,
    sourceCode: string,
    fitnessBefore: FitnessScore,
    fitnessAfter: FitnessScore,
  ): Promise<{ improvement: CodeImprovement; applied: boolean }> {
    if (!this.config.enabled) {
      return {
        improvement: {
          id: randomUUID(),
          filePath,
          description: 'disabled',
          diff: '',
          reasoning: 'evolution disabled',
          fitnessBefore,
          fitnessAfter: null,
          status: 'rejected',
          timestamp: new Date(),
        },
        applied: false,
      };
    }

    if (!this.checkDailyLimit()) {
      log.warn({ cyclesToday: this.cyclesToday, max: this.config.maxCyclesPerDay }, 'daily evolution limit reached');
      return {
        improvement: {
          id: randomUUID(),
          filePath,
          description: 'daily limit reached',
          diff: '',
          reasoning: 'max cycles per day exceeded',
          fitnessBefore,
          fitnessAfter: null,
          status: 'rejected',
          timestamp: new Date(),
        },
        applied: false,
      };
    }

    this.incrementDailyCounter();

    const improvements = await this.analyzeModule(filePath, sourceCode);

    if (improvements.length === 0) {
      return {
        improvement: {
          id: randomUUID(),
          filePath,
          description: 'no improvements found',
          diff: '',
          reasoning: 'analysis found no opportunities',
          fitnessBefore,
          fitnessAfter: null,
          status: 'rejected',
          timestamp: new Date(),
        },
        applied: false,
      };
    }

    const improvement = improvements[0];
    improvement.fitnessBefore = fitnessBefore;
    improvement.fitnessAfter = fitnessAfter;
    improvement.status = this.shouldApply(fitnessBefore, fitnessAfter) ? 'applied' : 'rejected';

    if (improvement.status === 'applied') {
      const entry: EvolutionArchiveEntry = {
        id: randomUUID(),
        improvement,
        appliedAt: new Date(),
        fitnessDelta: fitnessAfter.overall - fitnessBefore.overall,
        commitHash: randomUUID().slice(0, 8),
      };
      this.archive.push(entry);

      log.info({
        filePath,
        fitnessDelta: entry.fitnessDelta,
        commitHash: entry.commitHash,
      }, 'evolution cycle applied');
    }

    return { improvement, applied: improvement.status === 'applied' };
  }

  async rollback(improvementId: string): Promise<boolean> {
    const entry = this.archive.find((e) => e.improvement.id === improvementId);
    if (!entry) {
      log.warn({ improvementId }, 'rollback target not found in archive');
      return false;
    }

    entry.improvement.status = 'rolled_back';
    incCounter('evolution_rollbacks', 'Evolution rollbacks', 1);

    log.info({
      improvementId,
      filePath: entry.improvement.filePath,
      fitnessDelta: entry.fitnessDelta,
    }, 'evolution rolled back');

    return true;
  }

  getArchive(): EvolutionArchiveEntry[] {
    return [...this.archive];
  }

  getArchiveStats(): {
    totalEntries: number;
    appliedCount: number;
    rolledBackCount: number;
    avgFitnessDelta: number;
  } {
    const applied = this.archive.filter((e) => e.improvement.status === 'applied');
    const rolledBack = this.archive.filter((e) => e.improvement.status === 'rolled_back');
    const avgDelta = this.archive.length > 0
      ? this.archive.reduce((s, e) => s + e.fitnessDelta, 0) / this.archive.length
      : 0;

    return {
      totalEntries: this.archive.length,
      appliedCount: applied.length,
      rolledBackCount: rolledBack.length,
      avgFitnessDelta: avgDelta,
    };
  }

  getConfig(): EvolutionConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<EvolutionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    this.archive = [];
    this.cyclesToday = 0;
    this.lastCycleDate = null;
  }

  private calculateOverallFitness(score: Omit<FitnessScore, 'overall'>): number {
    // Weighted: test pass rate (40%), coverage (25%), speed (20%), token usage (15%)
    const testWeight = 0.40;
    const coverageWeight = 0.25;
    const speedWeight = 0.20;
    const tokenWeight = 0.15;

    const speedScore = Math.max(0, 1 - score.executionSpeedMs / 10000);
    const tokenScore = Math.max(0, 1 - score.tokenUsage / 100000);

    return (
      score.testPassRate * testWeight +
      score.codeCoverage * coverageWeight +
      speedScore * speedWeight +
      tokenScore * tokenWeight
    );
  }

  private checkDailyLimit(): boolean {
    const today = new Date().toDateString();
    if (this.lastCycleDate !== today) {
      this.lastCycleDate = today;
      this.cyclesToday = 0;
    }
    return this.cyclesToday < this.config.maxCyclesPerDay;
  }

  private incrementDailyCounter(): void {
    this.cyclesToday++;
  }

  private parseImprovements(content: string, defaultFilePath: string): CodeImprovement[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const raw = JSON.parse(jsonMatch[0]) as {
        improvements?: Array<{
          filePath?: string;
          description?: string;
          reasoning?: string;
          diff?: string;
        }>;
      };

      if (!Array.isArray(raw.improvements)) return [];

      return raw.improvements.map((imp) => ({
        id: randomUUID(),
        filePath: imp.filePath ?? defaultFilePath,
        description: imp.description ?? 'unknown improvement',
        reasoning: imp.reasoning ?? '',
        diff: imp.diff ?? '',
        fitnessBefore: { testPassRate: 0, executionSpeedMs: 0, tokenUsage: 0, codeCoverage: 0, overall: 0 },
        fitnessAfter: null,
        status: 'proposed' as const,
        timestamp: new Date(),
      }));
    } catch {
      return [];
    }
  }

  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    return new RegExp(escaped);
  }
}
