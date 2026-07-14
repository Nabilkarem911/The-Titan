import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'evolutionary-solver' });

interface SolutionCandidate {
  id: string;
  generation: number;
  parentId?: string;
  code: string;
  description: string;
  score: number;
  fitness: number;
  isElite: boolean;
  createdAt: Date;
}

interface GenerationResult {
  generation: number;
  populationSize: number;
  bestScore: number;
  avgScore: number;
  candidates: SolutionCandidate[];
  improved: boolean;
}

interface EvolutionResult {
  taskId: string;
  problem: string;
  generations: GenerationResult[];
  bestSolution: SolutionCandidate | null;
  totalCandidates: number;
  converged: boolean;
  durationMs: number;
}

const GENERATE_PROMPT = `You are an evolutionary code generation agent. Generate a solution for the given problem.

Rules:
1. Generate clean, working code
2. Be creative — try different approaches
3. Include a brief description of the approach

Respond in JSON:
{
  "code": "the solution code",
  "description": "approach description"
}`;

const MUTATE_PROMPT = `You are an evolutionary mutation agent. Given a parent solution and its score, create a mutated child that might score higher.

Mutation strategies:
1. Optimize performance bottlenecks
2. Fix edge cases the parent missed
3. Try a different algorithm for sub-parts
4. Simplify complex logic
5. Add error handling

Respond in JSON:
{
  "code": "the mutated solution",
  "description": "what was mutated and why"
}`;

const SCORE_PROMPT = `You are a solution scoring agent. Score the given solution for the given problem on a scale of 0-100.

Consider:
1. Correctness — does it solve the problem?
2. Efficiency — is it performant?
3. Robustness — does it handle edge cases?
4. Readability — is it clean code?

Respond in JSON:
{
  "score": 0-100,
  "fitness": 0-1,
  "notes": "brief explanation"
}`;

export class EvolutionarySolver {
  constructor(private llm: LlmProvider) {}

  async evolve(
    problem: string,
    options?: {
      populationSize?: number;
      generations?: number;
      eliteRatio?: number;
      mutationRate?: number;
    },
  ): Promise<EvolutionResult> {
    const popSize = options?.populationSize ?? 4;
    const maxGens = options?.generations ?? 3;
    const eliteRatio = options?.eliteRatio ?? 0.25;
    const mutationRate = options?.mutationRate ?? 0.7;
    const taskId = randomUUID().slice(0, 8);
    const startedAt = Date.now();

    log.info({ taskId, problem: problem.slice(0, 80), popSize, maxGens }, 'evolution started');

    const generations: GenerationResult[] = [];
    let population: SolutionCandidate[] = [];
    let totalCandidates = 0;
    let prevBest = 0;
    let converged = false;

    for (let gen = 0; gen < maxGens; gen++) {
      // Generate or mutate population
      if (gen === 0) {
        // Initial generation — generate diverse solutions
        for (let i = 0; i < popSize; i++) {
          const candidate = await this.generateCandidate(problem, gen);
          population.push(candidate);
          totalCandidates++;
        }
      } else {
        // Selection — keep elites
        const eliteCount = Math.max(1, Math.floor(popSize * eliteRatio));
        const elites = population
          .sort((a, b) => b.score - a.score)
          .slice(0, eliteCount)
          .map((e) => ({ ...e, isElite: true }));

        // Crossover + mutation for new children
        const children: SolutionCandidate[] = [];
        const needed = popSize - eliteCount;

        for (let i = 0; i < needed; i++) {
          const parent = elites[i % elites.length];
          if (Math.random() < mutationRate) {
            const child = await this.mutateCandidate(problem, parent, gen);
            children.push(child);
            totalCandidates++;
          } else {
            // Keep elite copy
            children.push({
              ...parent,
              id: randomUUID().slice(0, 8),
              isElite: false,
              createdAt: new Date(),
            });
          }
        }

        population = [...elites, ...children];
      }

      // Score all candidates
      for (const candidate of population) {
        if (candidate.score === 0 && gen > 0) {
          candidate.score = await this.scoreCandidate(problem, candidate);
        } else if (gen === 0) {
          candidate.score = await this.scoreCandidate(problem, candidate);
        }
      }

      // Sort by score
      population.sort((a, b) => b.score - a.score);

      const bestScore = population[0]?.score ?? 0;
      const avgScore = population.reduce((s, c) => s + c.score, 0) / population.length;

      const genResult: GenerationResult = {
        generation: gen,
        populationSize: population.length,
        bestScore,
        avgScore: Math.round(avgScore),
        candidates: population.map((c) => ({ ...c })),
        improved: bestScore > prevBest,
      };
      generations.push(genResult);
      prevBest = bestScore;

      log.info({ taskId, gen, bestScore, avgScore: Math.round(avgScore) }, 'generation complete');

      // Check convergence
      if (gen > 0 && bestScore >= 95) {
        converged = true;
        log.info({ taskId, gen, bestScore }, 'converged — stopping early');
        break;
      }
    }

    const bestSolution = population[0] ?? null;

    incCounter('evolution_run', 'Evolution runs', 1, { converged: converged ? 'true' : 'false' });
    incCounter('evolution_candidates', 'Total candidates generated', totalCandidates);

    const result: EvolutionResult = {
      taskId,
      problem,
      generations,
      bestSolution,
      totalCandidates,
      converged,
      durationMs: Date.now() - startedAt,
    };

    log.info(
      { taskId, bestScore: bestSolution?.score, converged, durationMs: result.durationMs },
      'evolution complete',
    );

    return result;
  }

  private async generateCandidate(problem: string, generation: number): Promise<SolutionCandidate> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: GENERATE_PROMPT },
        { role: 'user', content: problem },
      ], { temperature: 0.7, maxTokens: 800 });

      const parsed = this.parseSolution(response.content);
      return {
        id: randomUUID().slice(0, 8),
        generation,
        code: parsed.code,
        description: parsed.description,
        score: 0,
        fitness: 0,
        isElite: false,
        createdAt: new Date(),
      };
    } catch {
      return {
        id: randomUUID().slice(0, 8),
        generation,
        code: '// generation failed',
        description: 'Failed to generate',
        score: 0,
        fitness: 0,
        isElite: false,
        createdAt: new Date(),
      };
    }
  }

  private async mutateCandidate(
    problem: string,
    parent: SolutionCandidate,
    generation: number,
  ): Promise<SolutionCandidate> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: MUTATE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            problem,
            parentCode: parent.code.slice(0, 500),
            parentScore: parent.score,
            parentDescription: parent.description,
          }),
        },
      ], { temperature: 0.5, maxTokens: 800 });

      const parsed = this.parseSolution(response.content);
      return {
        id: randomUUID().slice(0, 8),
        generation,
        parentId: parent.id,
        code: parsed.code,
        description: parsed.description,
        score: 0,
        fitness: 0,
        isElite: false,
        createdAt: new Date(),
      };
    } catch {
      return {
        ...parent,
        id: randomUUID().slice(0, 8),
        parentId: parent.id,
        isElite: false,
        createdAt: new Date(),
      };
    }
  }

  private async scoreCandidate(problem: string, candidate: SolutionCandidate): Promise<number> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: SCORE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            problem,
            code: candidate.code.slice(0, 500),
          }),
        },
      ], { temperature: 0.1, maxTokens: 300 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return 50;
      const raw = JSON.parse(jsonMatch[0]);
      const score = Math.max(0, Math.min(100, Number(raw.score ?? 50)));
      candidate.fitness = Math.max(0, Math.min(1, Number(raw.fitness ?? score / 100)));
      return score;
    } catch {
      return 50;
    }
  }

  private parseSolution(content: string): { code: string; description: string } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { code: content, description: 'raw output' };
      const raw = JSON.parse(jsonMatch[0]);
      return {
        code: String(raw.code ?? ''),
        description: String(raw.description ?? ''),
      };
    } catch {
      return { code: content, description: 'parse failed' };
    }
  }
}
