import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { swarmTopologies as stRepo, swarmCollectiveMemory as scmRepo, swarmMessages as smRepo, swarmFederationTasks as sftRepo } from '@titan/database';

const log = getLogger().child({ component: 'swarm-evolution' });

export type TopologyPattern = 'pipeline' | 'orchestrator-worker' | 'peer-to-peer' | 'hierarchical' | 'ring' | 'star';

export interface SwarmAgentRole {
  id: string;
  agentId: string;
  role: string;
  specialization: string;
  performanceScore: number;
}

export interface SwarmTopologyConfig {
  id: string;
  pattern: TopologyPattern;
  agentCount: number;
  roles: SwarmAgentRole[];
  createdAt: Date;
  reconfigured: boolean;
}

export interface CollectiveMemoryEntry {
  id: string;
  key: string;
  value: unknown;
  version: number;
  writtenBy: string;
  timestamp: Date;
  conflicts: Array<{ agentId: string; value: unknown; timestamp: Date }>;
}

export interface FederationTask {
  id: string;
  fromAgent: string;
  toAgent: string;
  type: 'delegation' | 'skill_exchange' | 'federated_learning';
  payload: unknown;
  status: 'pending' | 'accepted' | 'completed' | 'rejected';
  createdAt: Date;
}

const MAX_AGENTS = 20;
const TASK_TIMEOUT_MS = 5 * 60 * 1000;
const TOTAL_TIMEOUT_MS = 30 * 60 * 1000;

export class SwarmEvolution {
  private topologies: SwarmTopologyConfig[] = [];
  private collectiveMemory: Map<string, CollectiveMemoryEntry> = new Map();
  private federationTasks: FederationTask[] = [];
  private currentTopology: SwarmTopologyConfig | null = null;

  autoDecideAgentCount(complexity: number): number {
    const count = Math.min(MAX_AGENTS, Math.max(1, Math.ceil(complexity / 10)));
    log.info({ complexity, agentCount: count }, 'auto-decided agent count');
    return count;
  }

  detectEmergentSpecialization(agentId: string, taskResults: Array<{ task: string; success: boolean; score: number }>): SwarmAgentRole {
    const domainScores: Record<string, { total: number; count: number }> = {};

    for (const result of taskResults) {
      const domain = this.classifyTask(result.task);
      if (!domainScores[domain]) domainScores[domain] = { total: 0, count: 0 };
      domainScores[domain].total += result.score;
      domainScores[domain].count++;
    }

    let bestDomain = 'general';
    let bestAvg = 0;
    for (const [domain, scores] of Object.entries(domainScores)) {
      const avg = scores.total / scores.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestDomain = domain;
      }
    }

    const role: SwarmAgentRole = {
      id: randomUUID(),
      agentId,
      role: bestDomain,
      specialization: bestDomain,
      performanceScore: bestAvg,
    };

    incCounter('swarm_specializations', 'Emergent specializations detected', 1);
    return role;
  }

  createTopology(pattern: TopologyPattern, agentCount: number, roles?: SwarmAgentRole[]): SwarmTopologyConfig {
    const config: SwarmTopologyConfig = {
      id: randomUUID(),
      pattern,
      agentCount: Math.min(MAX_AGENTS, agentCount),
      roles: roles ?? [],
      createdAt: new Date(),
      reconfigured: false,
    };

    this.currentTopology = config;
    this.topologies.push(config);
    stRepo.insert(config.id, { name: config.pattern, config: JSON.stringify(config), performance: 0, is_current: true }).catch(() => {});
    incCounter('swarm_topologies', 'Swarm topologies created', 1);
    return config;
  }

  reconfigureTopology(newPattern: TopologyPattern): SwarmTopologyConfig | null {
    if (!this.currentTopology) return null;

    this.currentTopology.reconfigured = true;
    this.currentTopology.pattern = newPattern;

    const newConfig: SwarmTopologyConfig = {
      ...this.currentTopology,
      id: randomUUID(),
      createdAt: new Date(),
      reconfigured: false,
    };

    this.currentTopology = newConfig;
    this.topologies.push(newConfig);
    stRepo.insert(newConfig.id, { name: newConfig.pattern, config: JSON.stringify(newConfig), performance: 0, is_current: true }).catch(() => {});
    incCounter('swarm_reconfigurations', 'Swarm reconfigurations', 1);
    log.info({ from: this.currentTopology.pattern, to: newPattern }, 'topology reconfigured');
    return newConfig;
  }

  selectBestPattern(taskType: string): TopologyPattern {
    const patternMap: Record<string, TopologyPattern> = {
      'parallel': 'orchestrator-worker',
      'sequential': 'pipeline',
      'collaborative': 'peer-to-peer',
      'delegation': 'hierarchical',
      'review': 'ring',
      'broadcast': 'star',
    };
    return patternMap[taskType] ?? 'orchestrator-worker';
  }

  writeCollectiveMemory(key: string, value: unknown, agentId: string): CollectiveMemoryEntry {
    const existing = this.collectiveMemory.get(key);
    const entry: CollectiveMemoryEntry = {
      id: randomUUID(),
      key,
      value,
      version: existing ? existing.version + 1 : 1,
      writtenBy: agentId,
      timestamp: new Date(),
      conflicts: [],
    };

    if (existing && JSON.stringify(existing.value) !== JSON.stringify(value)) {
      entry.conflicts.push({
        agentId: existing.writtenBy,
        value: existing.value,
        timestamp: existing.timestamp,
      });
    }

    this.collectiveMemory.set(key, entry);
    scmRepo.insert(randomUUID().slice(0, 12), { key, value: entry.value, agent_id: entry.writtenBy }).catch(() => {});
    incCounter('collective_memory_writes', 'Collective memory writes', 1);
    return entry;
  }

  readCollectiveMemory(key: string): CollectiveMemoryEntry | null {
    return this.collectiveMemory.get(key) ?? null;
  }

  resolveConflict(key: string): CollectiveMemoryEntry | null {
    const entry = this.collectiveMemory.get(key);
    if (!entry || entry.conflicts.length === 0) return entry ?? null;

    // Last-writer-wins with version vector
    entry.conflicts = [];
    this.collectiveMemory.set(key, entry);
    incCounter('collective_memory_conflicts_resolved', 'Memory conflicts resolved', 1);
    return entry;
  }

  delegateTask(fromAgent: string, toAgent: string, payload: unknown): FederationTask {
    const task: FederationTask = {
      id: randomUUID(),
      fromAgent,
      toAgent,
      type: 'delegation',
      payload,
      status: 'pending',
      createdAt: new Date(),
    };

    this.federationTasks.push(task);
    sftRepo.insert(task.id, task.type, task.fromAgent, task.toAgent, '').catch(() => {});
    incCounter('federation_delegations', 'Federation delegations', 1);
    return task;
  }

  exchangeSkill(fromAgent: string, toAgent: string, skill: unknown): FederationTask {
    const task: FederationTask = {
      id: randomUUID(),
      fromAgent,
      toAgent,
      type: 'skill_exchange',
      payload: skill,
      status: 'pending',
      createdAt: new Date(),
    };

    this.federationTasks.push(task);
    sftRepo.insert(task.id, task.type, task.fromAgent, task.toAgent, '').catch(() => {});
    incCounter('federation_skill_exchanges', 'Skill exchanges', 1);
    return task;
  }

  federatedLearn(fromAgent: string, toAgent: string, modelDiff: unknown): FederationTask {
    const task: FederationTask = {
      id: randomUUID(),
      fromAgent,
      toAgent,
      type: 'federated_learning',
      payload: modelDiff,
      status: 'pending',
      createdAt: new Date(),
    };

    this.federationTasks.push(task);
    sftRepo.insert(task.id, task.type, task.fromAgent, task.toAgent, '').catch(() => {});
    incCounter('federation_learning', 'Federated learning transfers', 1);
    return task;
  }

  completeFederationTask(taskId: string, status: 'accepted' | 'completed' | 'rejected'): void {
    const task = this.federationTasks.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
    }
  }

  getTopologies(): SwarmTopologyConfig[] {
    return [...this.topologies];
  }

  getCurrentTopology(): SwarmTopologyConfig | null {
    return this.currentTopology;
  }

  getFederationTasks(): FederationTask[] {
    return [...this.federationTasks];
  }

  getCollectiveMemorySize(): number {
    return this.collectiveMemory.size;
  }

  getStats(): {
    topologiesCreated: number;
    reconfigurations: number;
    memoryEntries: number;
    federationTasks: number;
    completedTasks: number;
  } {
    return {
      topologiesCreated: this.topologies.length,
      reconfigurations: this.topologies.filter((t) => t.reconfigured).length,
      memoryEntries: this.collectiveMemory.size,
      federationTasks: this.federationTasks.length,
      completedTasks: this.federationTasks.filter((t) => t.status === 'completed').length,
    };
  }

  reset(): void {
    this.topologies = [];
    this.collectiveMemory.clear();
    this.federationTasks = [];
    this.currentTopology = null;
  }

  private classifyTask(task: string): string {
    const lower = task.toLowerCase();
    if (lower.includes('code') || lower.includes('implement')) return 'coding';
    if (lower.includes('debug') || lower.includes('fix')) return 'debugging';
    if (lower.includes('test')) return 'testing';
    if (lower.includes('analyze') || lower.includes('review')) return 'analysis';
    if (lower.includes('design') || lower.includes('architect')) return 'architecture';
    return 'general';
  }
}
