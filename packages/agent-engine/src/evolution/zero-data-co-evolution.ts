import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'co-evolution' });

interface CurriculumTask {
  id: string;
  description: string;
  difficulty: number;
  domain: string;
  skills: string[];
  createdAt: Date;
}

interface ExecutionResult {
  id: string;
  taskId: string;
  success: boolean;
  score: number;
  durationMs: number;
  approach: string;
  lessonsLearned: string[];
}

interface CoEvolutionState {
  currentDifficulty: number;
  tasksGenerated: number;
  tasksSolved: number;
  tasksFailed: number;
  skillGains: Array<{ skill: string; gain: number }>;
  domainsExplored: string[];
}

const CURRICULUM_PROMPT = `You are a curriculum generator for an AI agent's self-play. Generate a task at the specified difficulty level.

Respond in JSON:
{
  "description": "the task description",
  "domain": "coding|reasoning|planning|debugging|analysis",
  "skills": ["skill1", "skill2"]
}`;

const MAX_DIFFICULTY = 10;
const MIN_DIFFICULTY = 1;
const DIFFICULTY_STRETCH = 1.2;

export class ZeroDataCoEvolution {
  private llm: LlmProvider;
  private state: CoEvolutionState;
  private tasks: CurriculumTask[] = [];
  private results: ExecutionResult[] = [];
  private maxTasks = 1000;

  constructor(llm: LlmProvider) {
    this.llm = llm;
    this.state = {
      currentDifficulty: MIN_DIFFICULTY,
      tasksGenerated: 0,
      tasksSolved: 0,
      tasksFailed: 0,
      skillGains: [],
      domainsExplored: [],
    };
  }

  async generateTask(): Promise<CurriculumTask> {
    const difficulty = Math.min(MAX_DIFFICULTY, this.state.currentDifficulty);

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: CURRICULUM_PROMPT },
        { role: 'user', content: `Generate a task at difficulty ${difficulty}/10. Current skill level: ${this.state.tasksSolved} tasks solved.` },
      ], { temperature: 0.6, maxTokens: 300 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      let description = `Solve a ${difficulty}/10 difficulty problem`;
      let domain = 'reasoning';
      let skills: string[] = [];

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        description = parsed.description ?? description;
        domain = parsed.domain ?? domain;
        skills = Array.isArray(parsed.skills) ? parsed.skills : [];
      }

      const task: CurriculumTask = {
        id: randomUUID(),
        description,
        difficulty,
        domain,
        skills,
        createdAt: new Date(),
      };

      this.tasks.push(task);
      this.state.tasksGenerated++;

      if (!this.state.domainsExplored.includes(domain)) {
        this.state.domainsExplored.push(domain);
      }

      if (this.tasks.length > this.maxTasks) {
        this.tasks.shift();
      }

      incCounter('coevolution_tasks_generated', 'Co-evolution tasks generated', 1);
      return task;
    } catch (err) {
      log.error({ err }, 'task generation failed');
      return this.fallbackTask(difficulty);
    }
  }

  async executeTask(task: CurriculumTask, solver: (task: CurriculumTask) => Promise<{ success: boolean; score: number; approach: string; lessons: string[] }>): Promise<ExecutionResult> {
    const startTime = Date.now();

    let result: ExecutionResult;
    try {
      const solved = await solver(task);
      result = {
        id: randomUUID(),
        taskId: task.id,
        success: solved.success,
        score: solved.score,
        durationMs: Date.now() - startTime,
        approach: solved.approach,
        lessonsLearned: solved.lessons,
      };

      if (solved.success) {
        this.state.tasksSolved++;
        this.adjustDifficultyUp();
        this.recordSkillGains(task.skills, solved.score);
      } else {
        this.state.tasksFailed++;
        this.adjustDifficultyDown();
      }
    } catch (err) {
      log.error({ err, taskId: task.id }, 'task execution failed');
      result = {
        id: randomUUID(),
        taskId: task.id,
        success: false,
        score: 0,
        durationMs: Date.now() - startTime,
        approach: 'failed',
        lessonsLearned: ['Execution error'],
      };
      this.state.tasksFailed++;
      this.adjustDifficultyDown();
    }

    this.results.push(result);
    if (this.results.length > this.maxTasks) {
      this.results.shift();
    }

    observeHistogram('coevolution_task_score', 'Co-evolution task scores', result.score);
    incCounter('coevolution_tasks_executed', 'Co-evolution tasks executed', 1);

    return result;
  }

  async runCoEvolutionCycle(solver: (task: CurriculumTask) => Promise<{ success: boolean; score: number; approach: string; lessons: string[] }>, cycles: number = 10): Promise<ExecutionResult[]> {
    const allResults: ExecutionResult[] = [];

    for (let i = 0; i < cycles; i++) {
      const task = await this.generateTask();
      const result = await this.executeTask(task, solver);
      allResults.push(result);

      log.info({
        cycle: i + 1,
        difficulty: this.state.currentDifficulty,
        success: result.success,
        score: result.score,
      }, 'co-evolution cycle completed');
    }

    return allResults;
  }

  getState(): CoEvolutionState {
    return { ...this.state };
  }

  getTasks(): CurriculumTask[] {
    return [...this.tasks];
  }

  getResults(): ExecutionResult[] {
    return [...this.results];
  }

  getStats(): {
    generated: number;
    solved: number;
    failed: number;
    successRate: number;
    currentDifficulty: number;
    domains: string[];
  } {
    const total = this.state.tasksSolved + this.state.tasksFailed;
    return {
      generated: this.state.tasksGenerated,
      solved: this.state.tasksSolved,
      failed: this.state.tasksFailed,
      successRate: total > 0 ? (this.state.tasksSolved / total) * 100 : 0,
      currentDifficulty: this.state.currentDifficulty,
      domains: this.state.domainsExplored,
    };
  }

  reset(): void {
    this.state = {
      currentDifficulty: MIN_DIFFICULTY,
      tasksGenerated: 0,
      tasksSolved: 0,
      tasksFailed: 0,
      skillGains: [],
      domainsExplored: [],
    };
    this.tasks = [];
    this.results = [];
  }

  private adjustDifficultyUp(): void {
    this.state.currentDifficulty = Math.min(MAX_DIFFICULTY, this.state.currentDifficulty * DIFFICULTY_STRETCH);
  }

  private adjustDifficultyDown(): void {
    this.state.currentDifficulty = Math.max(MIN_DIFFICULTY, this.state.currentDifficulty * 0.9);
  }

  private recordSkillGains(skills: string[], score: number): void {
    for (const skill of skills) {
      const existing = this.state.skillGains.find((s) => s.skill === skill);
      if (existing) {
        existing.gain += score * 0.1;
      } else {
        this.state.skillGains.push({ skill, gain: score * 0.1 });
      }
    }
  }

  private fallbackTask(difficulty: number): CurriculumTask {
    return {
      id: randomUUID(),
      description: `Solve a reasoning problem at difficulty ${difficulty}`,
      difficulty,
      domain: 'reasoning',
      skills: ['logic'],
      createdAt: new Date(),
    };
  }
}
