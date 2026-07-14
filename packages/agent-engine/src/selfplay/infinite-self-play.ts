import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { selfPlayArchive as spaRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'self-play' });

interface SelfPlayTask {
  id: string;
  description: string;
  difficulty: number;
  domain: string;
  expectedOutput: string;
  constraints: string[];
  createdAt: Date;
}

interface SelfPlayResult {
  taskId: string;
  solution: string;
  success: boolean;
  score: number;
  tokensUsed: number;
  durationMs: number;
  trajectory: Array<{ step: string; thought: string; action: string }>;
}

interface EvolutionaryEntry {
  id: string;
  taskId: string;
  domain: string;
  difficulty: number;
  score: number;
  success: boolean;
  timestamp: Date;
  capabilityGained: string | null;
  trajectory: SelfPlayResult['trajectory'];
}

interface CapabilityHorizon {
  domain: string;
  currentLevel: number;
  maxAchieved: number;
  stretchTarget: number;
  totalAttempts: number;
  successRate: number;
}

const MAX_ITERATIONS = 100;
const MAX_SESSION_HOURS = 4;
const STRETCH_PERCENT = 0.10;
const MAX_NEW_DOMAINS_PER_WEEK = 1;
const ARCHIVE_MAX = 10000;

const CURRICULUM_PROMPT = `You are a curriculum generator for an AI agent's self-play training.

Generate a task that is slightly harder than the agent's current capability level.
The task should be within the agent's capability boundary + 10% stretch.

Respond in JSON:
{
  "description": "task description",
  "difficulty": 1-10,
  "domain": "coding|reasoning|creative|analysis|debugging",
  "expectedOutput": "what the correct output looks like",
  "constraints": ["constraint1", "constraint2"]
}`;

const EVALUATION_PROMPT = `You are a task evaluator. Score the solution on a scale of 0-100.

Respond in JSON:
{
  "score": 0-100,
  "success": true | false,
  "feedback": "brief feedback",
  "capabilityGained": "what new capability was demonstrated, or null"
}`;

export class InfiniteSelfPlay {
  private llm: LlmProvider;
  private archive: EvolutionaryEntry[] = [];
  private horizons: Map<string, CapabilityHorizon> = new Map();
  private enabled = false;
  private iterationCount = 0;
  private sessionStartTime: Date | null = null;
  private newDomainsThisWeek: Set<string> = new Set();
  private weekStart: Date = new Date();

  constructor(llm: LlmProvider) {
    this.llm = llm;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.enabled = true;
    log.info('infinite self-play enabled');
  }

  disable(): void {
    this.enabled = false;
    this.stopSession();
    log.info('infinite self-play disabled (kill switch)');
  }

  async runSession(maxIterations?: number): Promise<{
    iterations: number;
    results: SelfPlayResult[];
    newCapabilities: string[];
  }> {
    if (!this.enabled) {
      return { iterations: 0, results: [], newCapabilities: [] };
    }

    const maxIters = Math.min(maxIterations ?? MAX_ITERATIONS, MAX_ITERATIONS);
    this.sessionStartTime = new Date();
    this.iterationCount = 0;

    const results: SelfPlayResult[] = [];
    const newCapabilities: string[] = [];

    for (let i = 0; i < maxIters; i++) {
      if (this.isSessionExpired()) {
        log.info({ iterations: i }, 'session time limit reached');
        break;
      }

      this.iterationCount = i + 1;

      try {
        // 1. Generate task
        const task = await this.generateTask();
        incCounter('selfplay_tasks_generated', 'Self-play tasks generated', 1, { domain: task.domain });

        // 2. Solve task
        const result = await this.solveTask(task);
        results.push(result);

        // 3. Evaluate
        const evaluation = await this.evaluateSolution(task, result);
        incCounter('selfplay_tasks_evaluated', 'Self-play tasks evaluated', 1, {
          success: evaluation.success ? 'true' : 'false',
        });

        // 4. Record in evolutionary archive
        const entry: EvolutionaryEntry = {
          id: randomUUID(),
          taskId: task.id,
          domain: task.domain,
          difficulty: task.difficulty,
          score: evaluation.score,
          success: evaluation.success,
          timestamp: new Date(),
          capabilityGained: evaluation.capabilityGained,
          trajectory: result.trajectory,
        };
        this.addToArchive(entry);

        // 5. Update capability horizon
        this.updateHorizon(task.domain, task.difficulty, evaluation.success);

        // 6. Track new capabilities
        if (evaluation.capabilityGained) {
          newCapabilities.push(evaluation.capabilityGained);
          incCounter('selfplay_capabilities_gained', 'New capabilities discovered', 1);
        }

        observeHistogram('selfplay_task_score', 'Self-play task scores', evaluation.score);
        observeHistogram('selfplay_task_difficulty', 'Self-play task difficulty', task.difficulty);

        log.info({
          iteration: i + 1,
          domain: task.domain,
          difficulty: task.difficulty,
          score: evaluation.score,
          success: evaluation.success,
        }, 'self-play iteration completed');
      } catch (err) {
        log.warn({ err, iteration: i }, 'self-play iteration failed — continuing');
      }
    }

    log.info({
      iterations: this.iterationCount,
      newCapabilities: newCapabilities.length,
    }, 'self-play session completed');

    return {
      iterations: this.iterationCount,
      results,
      newCapabilities,
    };
  }

  private async generateTask(): Promise<SelfPlayTask> {
    const horizons = this.getAllHorizons();
    const context = horizons.length > 0
      ? horizons.map((h) => `${h.domain}: level ${h.currentLevel}, max ${h.maxAchieved}, success rate ${h.successRate}`)
      : 'no prior experience — start at level 1';

    const completion = await this.llm.complete([
      { role: 'system', content: CURRICULUM_PROMPT },
      {
        role: 'user',
        content: `Current capability levels:\n${context}\n\nGenerate a task at the appropriate difficulty level (current + ${STRETCH_PERCENT * 100}% stretch).`,
      },
    ], { temperature: 0.7, maxTokens: 500 });

    const parsed = this.parseTask(completion.content);
    return parsed;
  }

  private async solveTask(task: SelfPlayTask): Promise<SelfPlayResult> {
    const startTime = Date.now();
    const trajectory: SelfPlayResult['trajectory'] = [];

    const completion = await this.llm.complete([
      {
        role: 'system',
        content: 'You are an AI agent solving a self-play task. Think step by step. Show your reasoning.',
      },
      {
        role: 'user',
        content: `Task: ${task.description}\nDifficulty: ${task.difficulty}/10\nDomain: ${task.domain}\nConstraints: ${task.constraints.join(', ')}\n\nSolve this task.`,
      },
    ], { temperature: 0.3, maxTokens: 2000 });

    // Parse trajectory from completion
    const lines = completion.content.split('\n');
    for (const line of lines) {
      const stepMatch = line.match(/(?:step\s*\d+|^\d+[.)])/i);
      if (stepMatch) {
        trajectory.push({
          step: line.slice(0, 50),
          thought: line.slice(0, 200),
          action: line.slice(0, 200),
        });
      }
    }

    if (trajectory.length === 0) {
      trajectory.push({
        step: 'solution',
        thought: completion.content.slice(0, 200),
        action: 'generate solution',
      });
    }

    return {
      taskId: task.id,
      solution: completion.content,
      success: true, // will be determined by evaluation
      score: 0, // will be set by evaluation
      tokensUsed: completion.tokensUsed,
      durationMs: Date.now() - startTime,
      trajectory,
    };
  }

  private async evaluateSolution(
    task: SelfPlayTask,
    result: SelfPlayResult,
  ): Promise<{ score: number; success: boolean; capabilityGained: string | null }> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: EVALUATION_PROMPT },
        {
          role: 'user',
          content: `Task: ${task.description}\nExpected: ${task.expectedOutput}\n\nSolution:\n${result.solution.slice(0, 1000)}`,
        },
      ], { temperature: 0.1, maxTokens: 300 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { score: 50, success: false, capabilityGained: null };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        score?: number;
        success?: boolean;
        capabilityGained?: string | null;
      };

      return {
        score: Math.max(0, Math.min(100, parsed.score ?? 50)),
        success: Boolean(parsed.success ?? false),
        capabilityGained: parsed.capabilityGained ?? null,
      };
    } catch {
      return { score: 50, success: false, capabilityGained: null };
    }
  }

  private updateHorizon(domain: string, difficulty: number, success: boolean): void {
    const existing = this.horizons.get(domain);

    if (existing) {
      existing.totalAttempts++;
      if (success) {
        existing.maxAchieved = Math.max(existing.maxAchieved, difficulty);
        existing.currentLevel = Math.max(existing.currentLevel, difficulty);
      }
      existing.successRate = (existing.successRate * (existing.totalAttempts - 1) + (success ? 1 : 0)) / existing.totalAttempts;
      existing.stretchTarget = Math.min(10, existing.currentLevel + Math.ceil(existing.currentLevel * STRETCH_PERCENT));
    } else {
      // Check weekly new domain limit
      if (!this.newDomainsThisWeek.has(domain) && this.newDomainsThisWeek.size >= MAX_NEW_DOMAINS_PER_WEEK) {
        log.warn({ domain }, 'max new domains per week reached — skipping');
        return;
      }
      this.newDomainsThisWeek.add(domain);

      this.horizons.set(domain, {
        domain,
        currentLevel: success ? difficulty : 1,
        maxAchieved: success ? difficulty : 0,
        stretchTarget: Math.min(10, difficulty + 1),
        totalAttempts: 1,
        successRate: success ? 1 : 0,
      });
    }
  }

  private isSessionExpired(): boolean {
    if (!this.sessionStartTime) return false;
    const elapsed = Date.now() - this.sessionStartTime.getTime();
    return elapsed > MAX_SESSION_HOURS * 60 * 60 * 1000;
  }

  private stopSession(): void {
    this.sessionStartTime = null;
    this.iterationCount = 0;
  }

  private addToArchive(entry: EvolutionaryEntry): void {
    this.archive.push(entry);
    if (this.archive.length > ARCHIVE_MAX) {
      this.archive = this.archive.slice(-ARCHIVE_MAX);
    }
    spaRepo.insert(entry.id, { task: entry.taskId, outcome: entry.success ? 'success' : 'failure', performance: entry.score, mutation: entry.capabilityGained, generation: 0 }).catch((err) => log.error({ err }, 'DB write failed'));
  }

  getArchive(): EvolutionaryEntry[] {
    return [...this.archive];
  }

  getArchiveStats(): { totalEntries: number; successCount: number; avgScore: number; domains: string[] } {
    const successCount = this.archive.filter((e) => e.success).length;
    const avgScore = this.archive.length > 0
      ? this.archive.reduce((s, e) => s + e.score, 0) / this.archive.length
      : 0;
    const domains = [...new Set(this.archive.map((e) => e.domain))];

    return {
      totalEntries: this.archive.length,
      successCount,
      avgScore,
      domains,
    };
  }

  getHorizons(): CapabilityHorizon[] {
    return Array.from(this.horizons.values());
  }

  getHorizon(domain: string): CapabilityHorizon | undefined {
    return this.horizons.get(domain);
  }

  getAllHorizons(): CapabilityHorizon[] {
    return this.getHorizons();
  }

  resetWeek(): void {
    this.newDomainsThisWeek.clear();
    this.weekStart = new Date();
  }

  reset(): void {
    this.archive = [];
    this.horizons.clear();
    this.newDomainsThisWeek.clear();
    this.stopSession();
  }

  private parseTask(content: string): SelfPlayTask {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          id: randomUUID(),
          description: content.slice(0, 200),
          difficulty: 3,
          domain: 'reasoning',
          expectedOutput: 'correct answer',
          constraints: [],
          createdAt: new Date(),
        };
      }

      const raw = JSON.parse(jsonMatch[0]) as {
        description?: string;
        difficulty?: number;
        domain?: string;
        expectedOutput?: string;
        constraints?: string[];
      };

      return {
        id: randomUUID(),
        description: raw.description ?? 'unknown task',
        difficulty: Math.max(1, Math.min(10, raw.difficulty ?? 3)),
        domain: raw.domain ?? 'reasoning',
        expectedOutput: raw.expectedOutput ?? 'correct answer',
        constraints: Array.isArray(raw.constraints) ? raw.constraints : [],
        createdAt: new Date(),
      };
    } catch {
      return {
        id: randomUUID(),
        description: content.slice(0, 200),
        difficulty: 3,
        domain: 'reasoning',
        expectedOutput: 'correct answer',
        constraints: [],
        createdAt: new Date(),
      };
    }
  }
}
