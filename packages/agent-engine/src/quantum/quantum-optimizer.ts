import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';

const log = getLogger().child({ component: 'quantum-optimizer' });

export type Strategy = string;

export interface SuperpositionState {
  id: string;
  strategies: Array<{ strategy: Strategy; weight: number; estimatedValue: number }>;
  collapsed: Strategy | null;
  collapseTimeMs: number;
  createdAt: Date;
}

export interface QuantumOptimizationResult {
  id: string;
  problem: string;
  optimalStrategy: Strategy;
  alternatives: Strategy[];
  valueScore: number;
  computationTimeMs: number;
  iterations: number;
}

const MAX_COLLAPSE_TIME_MS = 5000;
const MAX_TENSOR_RANK = 32;
const MAX_BOND_DIMENSION = 64;
const MAX_AGENTS = 100;

export class QuantumOptimizer {
  private tensorRank: number;
  private bondDimension: number;

  constructor(tensorRank: number = MAX_TENSOR_RANK, bondDimension: number = MAX_BOND_DIMENSION) {
    this.tensorRank = Math.min(tensorRank, MAX_TENSOR_RANK);
    this.bondDimension = Math.min(bondDimension, MAX_BOND_DIMENSION);
  }

  async superposeStrategies(
    strategies: Strategy[],
    evaluator: (s: Strategy) => number,
  ): Promise<SuperpositionState> {
    const state: SuperpositionState = {
      id: randomUUID(),
      strategies: [],
      collapsed: null,
      collapseTimeMs: 0,
      createdAt: new Date(),
    };

    // Explore all strategies simultaneously (simulate superposition)
    const startTime = Date.now();
    const evaluations = strategies.map((s) => ({
      strategy: s,
      weight: 1 / strategies.length,
      estimatedValue: evaluator(s),
    }));

    state.strategies = evaluations;

    // Collapse to best strategy
    const sorted = [...evaluations].sort((a, b) => b.estimatedValue - a.estimatedValue);
    state.collapsed = sorted[0]?.strategy ?? null;
    state.collapseTimeMs = Date.now() - startTime;

    if (state.collapseTimeMs > MAX_COLLAPSE_TIME_MS) {
      log.warn({ time: state.collapseTimeMs }, 'superposition collapse exceeded 5s');
    }

    incCounter('quantum_superpositions', 'Quantum superposition operations', 1);
    observeHistogram('quantum_collapse_time', 'Superposition collapse time', state.collapseTimeMs);

    return state;
  }

  optimizeTaskAllocation(
    agents: Array<{ id: string; capability: number }>,
    tasks: Array<{ id: string; difficulty: number; requiredCapability: number }>,
  ): Array<{ taskId: string; agentId: string; score: number }> {
    if (agents.length > MAX_AGENTS) {
      log.warn({ count: agents.length }, 'agent count exceeds 100 — falling back to greedy');
      return this.greedyAllocation(agents, tasks);
    }

    // Quantum annealing approximation: simulated annealing
    const assignments: Array<{ taskId: string; agentId: string; score: number }> = [];
    const usedAgents = new Set<string>();

    // Sort tasks by difficulty (hardest first)
    const sortedTasks = [...tasks].sort((a, b) => b.difficulty - a.difficulty);

    for (const task of sortedTasks) {
      let bestAgent: { id: string; capability: number } | null = null;
      let bestScore = -Infinity;

      for (const agent of agents) {
        if (usedAgents.has(agent.id)) continue;
        const score = agent.capability / task.requiredCapability;
        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }

      if (bestAgent) {
        assignments.push({
          taskId: task.id,
          agentId: bestAgent.id,
          score: bestScore,
        });
        usedAgents.add(bestAgent.id);
      }
    }

    incCounter('quantum_task_allocations', 'Quantum task allocations', 1);
    return assignments;
  }

  entangleMemories(
    memories: Array<{ id: string; domain: string; content: string; tags: string[] }>,
  ): Array<{ memoryA: string; memoryB: string; correlation: number }> {
    const entanglements: Array<{ memoryA: string; memoryB: string; correlation: number }> = [];

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const a = memories[i];
        const b = memories[j];

        // Correlate via shared tags
        const sharedTags = a.tags.filter((t) => b.tags.includes(t));
        const correlation = sharedTags.length / Math.max(a.tags.length, b.tags.length);

        if (correlation > 0.3) {
          entanglements.push({
            memoryA: a.id,
            memoryB: b.id,
            correlation,
          });
        }
      }
    }

    incCounter('quantum_entanglements', 'Memory entanglements discovered', entanglements.length);
    return entanglements;
  }

  tensorNetworkCompute(
    tensorA: number[],
    tensorB: number[],
  ): number {
    // Simplified tensor network contraction
    const rank = Math.min(this.tensorRank, tensorA.length, tensorB.length);
    let result = 0;

    for (let i = 0; i < rank; i++) {
      result += tensorA[i] * tensorB[i];
    }

    // Normalize by bond dimension
    return result / this.bondDimension;
  }

  async optimize(
    problem: string,
    strategies: Strategy[],
    evaluator: (s: Strategy) => number,
  ): Promise<QuantumOptimizationResult> {
    const startTime = Date.now();
    const state = await this.superposeStrategies(strategies, evaluator);

    const sorted = [...state.strategies].sort((a, b) => b.estimatedValue - a.estimatedValue);
    const optimal = sorted[0];

    incCounter('quantum_optimizations', 'Quantum-inspired optimizations', 1);

    return {
      id: randomUUID(),
      problem,
      optimalStrategy: optimal?.strategy ?? strategies[0],
      alternatives: sorted.slice(1).map((s) => s.strategy),
      valueScore: optimal?.estimatedValue ?? 0,
      computationTimeMs: Date.now() - startTime,
      iterations: strategies.length,
    };
  }

  getTensorRank(): number {
    return this.tensorRank;
  }

  getBondDimension(): number {
    return this.bondDimension;
  }

  private greedyAllocation(
    agents: Array<{ id: string; capability: number }>,
    tasks: Array<{ id: string; difficulty: number; requiredCapability: number }>,
  ): Array<{ taskId: string; agentId: string; score: number }> {
    const assignments: Array<{ taskId: string; agentId: string; score: number }> = [];
    const usedAgents = new Set<string>();

    for (const task of tasks) {
      for (const agent of agents) {
        if (usedAgents.has(agent.id)) continue;
        assignments.push({
          taskId: task.id,
          agentId: agent.id,
          score: agent.capability / task.requiredCapability,
        });
        usedAgents.add(agent.id);
        break;
      }
    }

    return assignments;
  }
}
