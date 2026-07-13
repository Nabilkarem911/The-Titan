import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { rlEpisodes, rlQTable } from '@titan/database';

const log = getLogger().child({ component: 'rl-environment' });

export interface RLState {
  id: string;
  features: number[];
  description: string;
  timestamp: Date;
}

export interface RLAction {
  id: string;
  name: string;
  expectedReward: number;
}

export interface RLEpisode {
  id: string;
  steps: Array<{ state: RLState; action: RLAction; reward: number; nextState: RLState }>;
  totalReward: number;
  success: boolean;
  startedAt: Date;
  completedAt?: Date;
}

export interface RLTrainingResult {
  episodes: number;
  avgReward: number;
  bestReward: number;
  converged: boolean;
  policy: Map<string, string>;
}

const MAX_EPISODES = 1000;
const MAX_STEPS_PER_EPISODE = 50;
const CONVERGENCE_THRESHOLD = 0.95;

export class RLEnvironment {
  private episodes: RLEpisode[] = [];
  private qTable: Map<string, Map<string, number>> = new Map();
  private learningRate: number;
  private discountFactor: number;
  private explorationRate: number;
  private currentEpisode: RLEpisode | null = null;

  constructor(learningRate = 0.1, discountFactor = 0.95, explorationRate = 0.1) {
    this.learningRate = learningRate;
    this.discountFactor = discountFactor;
    this.explorationRate = explorationRate;
  }

  startEpisode(initialState: RLState): RLEpisode {
    const episode: RLEpisode = {
      id: randomUUID(),
      steps: [],
      totalReward: 0,
      success: false,
      startedAt: new Date(),
    };

    this.currentEpisode = episode;
    log.info({ episodeId: episode.id }, 'RL episode started');
    return episode;
  }

  selectAction(state: RLState, availableActions: RLAction[]): RLAction {
    const stateKey = this.stateKey(state);

    // Epsilon-greedy
    if (Math.random() < this.explorationRate) {
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }

    // Exploit: pick best action from Q-table
    const stateQ = this.qTable.get(stateKey);
    if (!stateQ) {
      return availableActions[0];
    }

    let bestAction = availableActions[0];
    let bestQ = -Infinity;
    for (const action of availableActions) {
      const q = stateQ.get(action.name) ?? 0;
      if (q > bestQ) {
        bestQ = q;
        bestAction = action;
      }
    }

    return bestAction;
  }

  recordStep(state: RLState, action: RLAction, reward: number, nextState: RLState): void {
    if (!this.currentEpisode) return;

    this.currentEpisode.steps.push({ state, action, reward, nextState });
    this.currentEpisode.totalReward += reward;

    // Q-learning update
    this.updateQ(state, action, reward, nextState);
  }

  endEpisode(success: boolean): RLEpisode | null {
    if (!this.currentEpisode) return null;

    this.currentEpisode.success = success;
    this.currentEpisode.completedAt = new Date();

    this.episodes.push(this.currentEpisode);
    rlEpisodes.insert(this.currentEpisode.id, this.currentEpisode.totalReward, this.currentEpisode.steps.length, success, this.currentEpisode.startedAt, this.currentEpisode.completedAt).catch((err) => log.error({ err }, 'DB write failed'));
    if (this.episodes.length > MAX_EPISODES) {
      this.episodes.shift();
    }

    observeHistogram('rl_episode_reward', 'RL episode rewards', this.currentEpisode.totalReward);
    incCounter('rl_episodes', 'RL episodes completed', 1);

    log.info({
      episodeId: this.currentEpisode.id,
      steps: this.currentEpisode.steps.length,
      totalReward: this.currentEpisode.totalReward,
      success,
    }, 'RL episode completed');

    const episode = this.currentEpisode;
    this.currentEpisode = null;
    return episode;
  }

  train(
    stateGenerator: () => RLState,
    actionGenerator: (state: RLState) => RLAction[],
    rewardFunction: (state: RLState, action: RLAction, nextState: RLState) => number,
    terminationCheck: (state: RLState, steps: number) => boolean,
    episodes: number = 100,
  ): RLTrainingResult {
    const rewards: number[] = [];

    for (let i = 0; i < episodes; i++) {
      const state = stateGenerator();
      this.startEpisode(state);

      let currentState = state;
      for (let step = 0; step < MAX_STEPS_PER_EPISODE; step++) {
        const actions = actionGenerator(currentState);
        if (actions.length === 0) break;

        const action = this.selectAction(currentState, actions);
        const nextState: RLState = {
          id: randomUUID(),
          features: [...currentState.features],
          description: `step-${step}`,
          timestamp: new Date(),
        };

        const reward = rewardFunction(currentState, action, nextState);
        this.recordStep(currentState, action, reward, nextState);

        currentState = nextState;
        if (terminationCheck(currentState, step + 1)) break;
      }

      const episode = this.endEpisode(true);
      if (episode) rewards.push(episode.totalReward);
    }

    const avgReward = rewards.length > 0 ? rewards.reduce((s, r) => s + r, 0) / rewards.length : 0;
    const bestReward = rewards.length > 0 ? Math.max(...rewards) : 0;
    const recentAvg = rewards.slice(-10).reduce((s, r) => s + r, 0) / Math.max(1, Math.min(10, rewards.length));
    const converged = recentAvg / (bestReward || 1) >= CONVERGENCE_THRESHOLD;

    const policy = this.extractPolicy();

    const result: RLTrainingResult = {
      episodes: rewards.length,
      avgReward,
      bestReward,
      converged,
      policy,
    };

    log.info({ episodes: result.episodes, avgReward, bestReward, converged }, 'RL training completed');
    return result;
  }

  getEpisodes(): RLEpisode[] {
    return [...this.episodes];
  }

  getQTableSize(): number {
    return this.qTable.size;
  }

  getStats(): { totalEpisodes: number; avgReward: number; bestReward: number; qTableSize: number; converged: boolean } {
    const rewards = this.episodes.map((e) => e.totalReward);
    const avgReward = rewards.length > 0 ? rewards.reduce((s, r) => s + r, 0) / rewards.length : 0;
    const bestReward = rewards.length > 0 ? Math.max(...rewards) : 0;
    const recentAvg = rewards.slice(-10).reduce((s, r) => s + r, 0) / Math.max(1, Math.min(10, rewards.length));
    return {
      totalEpisodes: this.episodes.length,
      avgReward,
      bestReward,
      qTableSize: this.qTable.size,
      converged: bestReward > 0 && recentAvg / bestReward >= CONVERGENCE_THRESHOLD,
    };
  }

  reset(): void {
    this.episodes = [];
    this.qTable.clear();
    this.currentEpisode = null;
  }

  private updateQ(state: RLState, action: RLAction, reward: number, nextState: RLState): void {
    const stateKey = this.stateKey(state);
    const nextStateKey = this.stateKey(nextState);

    if (!this.qTable.has(stateKey)) this.qTable.set(stateKey, new Map());
    const stateQ = this.qTable.get(stateKey)!;

    const nextQ = this.qTable.get(nextStateKey);
    const maxNextQ = nextQ ? Math.max(...nextQ.values(), 0) : 0;

    const currentQ = stateQ.get(action.name) ?? 0;
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    stateQ.set(action.name, newQ);
    rlQTable.upsert(stateKey, action.name, newQ).catch((err) => log.error({ err }, 'DB write failed'));
  }

  private stateKey(state: RLState): string {
    return state.features.join(',');
  }

  private extractPolicy(): Map<string, string> {
    const policy = new Map<string, string>();
    for (const [stateKey, actions] of this.qTable) {
      let bestAction = '';
      let bestQ = -Infinity;
      for (const [action, q] of actions) {
        if (q > bestQ) {
          bestQ = q;
          bestAction = action;
        }
      }
      if (bestAction) policy.set(stateKey, bestAction);
    }
    return policy;
  }
}
