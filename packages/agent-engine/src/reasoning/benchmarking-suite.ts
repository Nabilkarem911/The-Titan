import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { benchmarkResults as brRepo, benchmarkSuites as bsRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'benchmarking-suite' });

export interface BenchmarkTask {
  id: string;
  name: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  prompt: string;
  expectedOutput?: string;
  evaluationCriteria?: string[];
  timeoutMs: number;
  maxSteps: number;
}

export interface BenchmarkResult {
  id: string;
  taskId: string;
  taskName: string;
  category: string;
  difficulty: string;
  response: string;
  passed: boolean;
  score: number;
  durationMs: number;
  stepsUsed: number;
  tokensUsed: number;
  evaluation: {
    correctness: number;
    completeness: number;
    efficiency: number;
    passed: boolean;
    reasoning: string;
  };
  createdAt: Date;
}

export interface BenchmarkSuiteResult {
  id: string;
  suiteName: string;
  totalTasks: number;
  passedTasks: number;
  failedTasks: number;
  avgScore: number;
  avgDurationMs: number;
  avgTokensUsed: number;
  byCategory: Array<{ category: string; total: number; passed: number; avgScore: number }>;
  byDifficulty: Array<{ difficulty: string; total: number; passed: number; avgScore: number }>;
  results: BenchmarkResult[];
  startedAt: Date;
  completedAt: Date;
}

export interface BenchmarkStats {
  totalSuites: number;
  totalTasks: number;
  totalPassed: number;
  passRate: number;
  avgScore: number;
  byCategory: Array<{ category: string; total: number; passed: number; avgScore: number }>;
  byDifficulty: Array<{ difficulty: string; total: number; passed: number; avgScore: number }>;
  recentSuites: Array<{ id: string; name: string; passRate: number; avgScore: number; date: Date }>;
}

const EVALUATE_PROMPT = `You are a benchmark evaluation module. Evaluate the agent's response to a task.

Task: {task}
Expected output: {expected}
Agent response: {response}
Evaluation criteria: {criteria}

Score on:
1. Correctness (0-1): Does the response answer the task correctly?
2. Completeness (0-1): Does it cover all aspects of the task?
3. Efficiency (0-1): Is the response concise and well-structured?

Respond in JSON:
{
  "correctness": 0-1,
  "completeness": 0-1,
  "efficiency": 0-1,
  "passed": true/false,
  "reasoning": "explanation"
}`;

const DEFAULT_TASKS: BenchmarkTask[] = [
  {
    id: 'bench-001',
    name: 'Simple Q&A',
    category: 'reasoning',
    difficulty: 'easy',
    prompt: 'What is the time complexity of binary search and why?',
    expectedOutput: 'O(log n) because each comparison halves the search space',
    evaluationCriteria: ['mentions O(log n)', 'explains halving'],
    timeoutMs: 30000,
    maxSteps: 3,
  },
  {
    id: 'bench-002',
    name: 'Code Generation',
    category: 'coding',
    difficulty: 'medium',
    prompt: 'Write a Python function to find the longest palindromic substring in a given string. Include time complexity analysis.',
    expectedOutput: 'Function with O(n^2) or O(n) algorithm with explanation',
    evaluationCriteria: ['correct algorithm', 'handles edge cases', 'complexity analysis'],
    timeoutMs: 60000,
    maxSteps: 5,
  },
  {
    id: 'bench-003',
    name: 'Multi-step Planning',
    category: 'planning',
    difficulty: 'hard',
    prompt: 'Design a distributed rate limiter that works across multiple server instances. Consider consistency, performance, and failure modes. Provide a step-by-step implementation plan.',
    expectedOutput: 'Detailed plan covering distributed state, consistency model, failure handling',
    evaluationCriteria: ['addresses distribution', 'consistency model', 'failure modes', 'step-by-step plan'],
    timeoutMs: 90000,
    maxSteps: 8,
  },
  {
    id: 'bench-004',
    name: 'Debugging',
    category: 'debugging',
    difficulty: 'medium',
    prompt: 'A function returns undefined intermittently: function getData(id) { return cache[id] ?? fetchFromDB(id); }. The cache is a Map. Why might this happen and how to fix it?',
    expectedOutput: 'Race condition between cache check and DB fetch, or async fetchFromDB not awaited',
    evaluationCriteria: ['identifies race condition', 'identifies async issue', 'proposes fix'],
    timeoutMs: 60000,
    maxSteps: 5,
  },
  {
    id: 'bench-005',
    name: 'Architecture Design',
    category: 'architecture',
    difficulty: 'expert',
    prompt: 'Design a real-time collaborative editing system (like Google Docs) with conflict resolution. Cover OT vs CRDT, presence, and offline support.',
    expectedOutput: 'Comprehensive design with OT/CRDT comparison, presence system, offline sync strategy',
    evaluationCriteria: ['OT vs CRDT analysis', 'presence mechanism', 'offline support', 'conflict resolution strategy'],
    timeoutMs: 120000,
    maxSteps: 10,
  },
  {
    id: 'bench-006',
    name: 'Data Analysis',
    category: 'analysis',
    difficulty: 'medium',
    prompt: 'Given a dataset of user purchases with columns [user_id, product_id, price, timestamp], write SQL to find the top 5 products by revenue in the last 30 days, and explain how to optimize this query for 100M rows.',
    expectedOutput: 'SQL query with optimization strategies (indexing, partitioning, materialized views)',
    evaluationCriteria: ['correct SQL', 'optimization strategies', 'handles scale'],
    timeoutMs: 60000,
    maxSteps: 5,
  },
  {
    id: 'bench-007',
    name: 'Creative Problem Solving',
    category: 'reasoning',
    difficulty: 'hard',
    prompt: 'You have a 5-liter jug and a 3-liter jug. How do you measure exactly 4 liters? Provide step-by-step reasoning.',
    expectedOutput: 'Step-by-step solution filling and pouring between jugs to get 4 liters',
    evaluationCriteria: ['correct solution', 'clear steps', 'verifiable reasoning'],
    timeoutMs: 60000,
    maxSteps: 5,
  },
  {
    id: 'bench-008',
    name: 'System Integration',
    category: 'architecture',
    difficulty: 'expert',
    prompt: 'Design an event-driven architecture for an e-commerce platform handling 10K orders/sec. Cover event schema, streaming infrastructure, exactly-once semantics, and saga pattern for distributed transactions.',
    expectedOutput: 'Complete architecture with event schemas, Kafka/Kinesis setup, exactly-once approach, saga implementation',
    evaluationCriteria: ['event schema design', 'streaming infra', 'exactly-once semantics', 'saga pattern'],
    timeoutMs: 120000,
    maxSteps: 10,
  },
];

export class BenchmarkingSuite {
  private suites: BenchmarkSuiteResult[] = [];
  private allResults: BenchmarkResult[] = [];
  private maxSuites = 50;
  private customTasks: BenchmarkTask[] = [];

  constructor(private llm: LlmProvider) {}

  async runSuite(
    suiteName: string,
    tasks?: BenchmarkTask[],
    opts?: { categories?: string[]; difficulties?: string[] },
  ): Promise<BenchmarkSuiteResult> {
    const suiteId = randomUUID().slice(0, 8);
    const taskList = tasks ?? this.customTasks.length > 0 ? this.customTasks : DEFAULT_TASKS;
    let filtered = taskList;

    if (opts?.categories) {
      filtered = filtered.filter((t) => opts.categories!.includes(t.category));
    }
    if (opts?.difficulties) {
      filtered = filtered.filter((t) => opts.difficulties!.includes(t.difficulty));
    }

    const startedAt = new Date();
    log.info({ suiteId, suiteName, taskCount: filtered.length }, 'benchmark suite started');

    const results: BenchmarkResult[] = [];
    for (const task of filtered) {
      const result = await this.runTask(task);
      results.push(result);
    }

    const passedTasks = results.filter((r) => r.passed).length;
    const completedAt = new Date();

    const byCategoryMap = new Map<string, { total: number; passed: number; scores: number[] }>();
    const byDifficultyMap = new Map<string, { total: number; passed: number; scores: number[] }>();

    for (const r of results) {
      const cat = byCategoryMap.get(r.category) ?? { total: 0, passed: 0, scores: [] };
      cat.total++;
      if (r.passed) cat.passed++;
      cat.scores.push(r.score);
      byCategoryMap.set(r.category, cat);

      const diff = byDifficultyMap.get(r.difficulty) ?? { total: 0, passed: 0, scores: [] };
      diff.total++;
      if (r.passed) diff.passed++;
      diff.scores.push(r.score);
      byDifficultyMap.set(r.difficulty, diff);
    }

    const suiteResult: BenchmarkSuiteResult = {
      id: suiteId,
      suiteName,
      totalTasks: results.length,
      passedTasks,
      failedTasks: results.length - passedTasks,
      avgScore: results.length > 0 ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 100) / 100 : 0,
      avgDurationMs: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.durationMs, 0) / results.length) : 0,
      avgTokensUsed: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.tokensUsed, 0) / results.length) : 0,
      byCategory: Array.from(byCategoryMap.entries()).map(([category, v]) => ({
        category,
        total: v.total,
        passed: v.passed,
        avgScore: v.scores.length > 0 ? Math.round((v.scores.reduce((s, sc) => s + sc, 0) / v.scores.length) * 100) / 100 : 0,
      })),
      byDifficulty: Array.from(byDifficultyMap.entries()).map(([difficulty, v]) => ({
        difficulty,
        total: v.total,
        passed: v.passed,
        avgScore: v.scores.length > 0 ? Math.round((v.scores.reduce((s, sc) => s + sc, 0) / v.scores.length) * 100) / 100 : 0,
      })),
      results,
      startedAt,
      completedAt,
    };

    this.suites.push(suiteResult);
    bsRepo.insert(suiteResult.id, suiteName, suiteResult.avgScore, suiteResult.results.length, startedAt, completedAt).catch((err) => log.error({ err }, 'DB write failed'));
    if (this.suites.length > this.maxSuites) {
      this.suites = this.suites.slice(-this.maxSuites);
    }
    this.allResults.push(...results);
    for (const r of results) {
      brRepo.insert(r.id, { suite_name: suiteName, task_name: r.taskName, score: r.score, duration_ms: r.durationMs, model: null }).catch((err) => log.error({ err }, 'DB write failed'));
    }

    incCounter('benchmark_suite', 'Benchmark suites', 1, { passed: passedTasks > results.length / 2 ? 'majority' : 'minority' });
    log.info({ suiteId, passedTasks, totalTasks: results.length, avgScore: suiteResult.avgScore }, 'benchmark suite complete');

    return suiteResult;
  }

  async runTask(task: BenchmarkTask): Promise<BenchmarkResult> {
    const startedAt = Date.now();

    try {
      const response = await this.llm.complete([
        { role: 'system', content: 'You are an expert AI assistant. Solve the following task thoroughly.' },
        { role: 'user', content: task.prompt },
      ], { temperature: 0.3, maxTokens: 1000 });

      const evaluation = await this.evaluateTask(task, response.content);

      const result: BenchmarkResult = {
        id: randomUUID().slice(0, 8),
        taskId: task.id,
        taskName: task.name,
        category: task.category,
        difficulty: task.difficulty,
        response: response.content.slice(0, 500),
        passed: evaluation.passed,
        score: Math.round(((evaluation.correctness + evaluation.completeness + evaluation.efficiency) / 3) * 100) / 100,
        durationMs: Date.now() - startedAt,
        stepsUsed: 1,
        tokensUsed: response.tokensUsed,
        evaluation,
        createdAt: new Date(),
      };

      incCounter('benchmark_task', 'Benchmark tasks', 1, { passed: result.passed ? 'true' : 'false', category: task.category });
      return result;
    } catch (err) {
      log.error({ err, taskId: task.id }, 'benchmark task failed');
      return {
        id: randomUUID().slice(0, 8),
        taskId: task.id,
        taskName: task.name,
        category: task.category,
        difficulty: task.difficulty,
        response: '',
        passed: false,
        score: 0,
        durationMs: Date.now() - startedAt,
        stepsUsed: 0,
        tokensUsed: 0,
        evaluation: { correctness: 0, completeness: 0, efficiency: 0, passed: false, reasoning: 'Task execution failed' },
        createdAt: new Date(),
      };
    }
  }

  addCustomTask(task: BenchmarkTask): void {
    this.customTasks.push(task);
    log.info({ taskId: task.id, name: task.name }, 'custom benchmark task added');
  }

  getDefaultTasks(): BenchmarkTask[] {
    return DEFAULT_TASKS;
  }

  getCustomTasks(): BenchmarkTask[] {
    return this.customTasks;
  }

  getSuites(): BenchmarkSuiteResult[] {
    return this.suites;
  }

  getSuite(id: string): BenchmarkSuiteResult | null {
    return this.suites.find((s) => s.id === id) ?? null;
  }

  getAllResults(): BenchmarkResult[] {
    return this.allResults;
  }

  stats(): BenchmarkStats {
    const total = this.allResults.length;
    const passed = this.allResults.filter((r) => r.passed).length;

    const byCategoryMap = new Map<string, { total: number; passed: number; scores: number[] }>();
    const byDifficultyMap = new Map<string, { total: number; passed: number; scores: number[] }>();

    for (const r of this.allResults) {
      const cat = byCategoryMap.get(r.category) ?? { total: 0, passed: 0, scores: [] };
      cat.total++;
      if (r.passed) cat.passed++;
      cat.scores.push(r.score);
      byCategoryMap.set(r.category, cat);

      const diff = byDifficultyMap.get(r.difficulty) ?? { total: 0, passed: 0, scores: [] };
      diff.total++;
      if (r.passed) diff.passed++;
      diff.scores.push(r.score);
      byDifficultyMap.set(r.difficulty, diff);
    }

    return {
      totalSuites: this.suites.length,
      totalTasks: total,
      totalPassed: passed,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      avgScore: total > 0 ? Math.round((this.allResults.reduce((s, r) => s + r.score, 0) / total) * 100) / 100 : 0,
      byCategory: Array.from(byCategoryMap.entries()).map(([category, v]) => ({
        category,
        total: v.total,
        passed: v.passed,
        avgScore: v.scores.length > 0 ? Math.round((v.scores.reduce((s, sc) => s + sc, 0) / v.scores.length) * 100) / 100 : 0,
      })),
      byDifficulty: Array.from(byDifficultyMap.entries()).map(([difficulty, v]) => ({
        difficulty,
        total: v.total,
        passed: v.passed,
        avgScore: v.scores.length > 0 ? Math.round((v.scores.reduce((s, sc) => s + sc, 0) / v.scores.length) * 100) / 100 : 0,
      })),
      recentSuites: this.suites.slice(-10).map((s) => ({
        id: s.id,
        name: s.suiteName,
        passRate: s.totalTasks > 0 ? Math.round((s.passedTasks / s.totalTasks) * 100) : 0,
        avgScore: s.avgScore,
        date: s.completedAt,
      })),
    };
  }

  clear(): void {
    this.suites = [];
    this.allResults = [];
  }

  private async evaluateTask(task: BenchmarkTask, response: string): Promise<BenchmarkResult['evaluation']> {
    try {
      const llmResponse = await this.llm.complete([
        {
          role: 'system',
          content: EVALUATE_PROMPT
            .replace('{task}', task.prompt)
            .replace('{expected}', task.expectedOutput ?? 'N/A')
            .replace('{response}', response.slice(0, 1000))
            .replace('{criteria}', JSON.stringify(task.evaluationCriteria ?? [])),
        },
        { role: 'user', content: 'Evaluate the response.' },
      ], { temperature: 0.1, maxTokens: 300 });

      const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);

      return {
        correctness: Math.max(0, Math.min(1, Number(raw.correctness ?? 0.5))),
        completeness: Math.max(0, Math.min(1, Number(raw.completeness ?? 0.5))),
        efficiency: Math.max(0, Math.min(1, Number(raw.efficiency ?? 0.5))),
        passed: Boolean(raw.passed ?? false),
        reasoning: String(raw.reasoning ?? ''),
      };
    } catch {
      const score = response.length > 100 ? 0.5 : 0.2;
      return {
        correctness: score,
        completeness: score,
        efficiency: score,
        passed: false,
        reasoning: 'Evaluation parse failed — heuristic scoring',
      };
    }
  }
}
