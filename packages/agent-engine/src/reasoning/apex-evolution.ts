import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { apexPatches as apRepo, apexPrinciples as aprRepo } from '@titan/database';
import type { LlmProvider, AgentRun } from '../types.js';

const log = getLogger().child({ component: 'apex-evolution' });

// ===== Layer 1: Harness Patching =====

interface HarnessPatch {
  id: string;
  targetModule: string;
  patchDescription: string;
  patchCode: string;
  expectedGain: number;
  riskLevel: 'low' | 'medium' | 'high';
  applied: boolean;
  reverted: boolean;
  performanceBefore: number;
  performanceAfter: number;
  createdAt: Date;
}

// ===== Layer 2: Principle Distillation =====

export interface Principle {
  id: string;
  name: string;
  description: string;
  category: 'efficiency' | 'accuracy' | 'safety' | 'collaboration' | 'reasoning';
  sourceRuns: string[];
  confidence: number;
  timesApplied: number;
  successRate: number;
  extractedFrom: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PrincipleExtractionResult {
  principles: Principle[];
  fromRunCount: number;
  patternsIdentified: string[];
}

// ===== Layer 3: Topology Evolution =====

type TopologyType = 'single-agent' | 'orchestrator-worker' | 'hierarchical' | 'swarm' | 'mesh' | 'pipeline';

interface TopologyConfig {
  type: TopologyType;
  agentCount: number;
  coordinationPattern: string;
  communicationOverhead: number;
  expectedThroughput: number;
  expectedLatency: number;
}

interface TopologyEvolutionResult {
  currentTopology: TopologyConfig;
  proposedTopology: TopologyConfig;
  reason: string;
  expectedImprovement: number;
  confidence: number;
  applied: boolean;
}

// ===== Combined APEX Result =====

interface ApexEvolutionResult {
  layer1Patches: HarnessPatch[];
  layer2Principles: Principle[];
  layer3Topology?: TopologyEvolutionResult;
  overallImprovement: number;
  cycle: number;
}

interface ApexStats {
  totalCycles: number;
  totalPatches: number;
  appliedPatches: number;
  revertedPatches: number;
  totalPrinciples: number;
  principleApplications: number;
  topologyChanges: number;
  avgImprovement: number;
}

const PRINCIPLE_EXTRACTION_PROMPT = `You are a principle extraction module. Analyze agent runs and extract reusable principles.

A principle is a generalizable lesson that can improve future performance. Examples:
- "When debugging, always check logs before modifying code"
- "For multi-step tasks, decompose into subtasks before execution"
- "When confidence is below 40%, request additional information"

Respond in JSON:
{
  "principles": [
    {
      "name": "short name",
      "description": "what the principle is",
      "category": "efficiency" | "accuracy" | "safety" | "collaboration" | "reasoning",
      "confidence": 0-100,
      "extractedFrom": "which run pattern this came from"
    }
  ],
  "patternsIdentified": ["pattern1", "pattern2"]
}`;

const TOPOLOGY_ANALYSIS_PROMPT = `You are a topology evolution module. Analyze task patterns and propose the best agent coordination topology.

Topologies:
- single-agent: One agent handles everything (low overhead, limited parallelism)
- orchestrator-worker: One orchestrator delegates to workers (good for parallel subtasks)
- hierarchical: Tree structure with managers and workers (good for complex decomposition)
- swarm: Many agents work independently on the same problem (good for exploration)
- mesh: Agents communicate peer-to-peer (good for collaborative reasoning)
- pipeline: Agents pass work through stages (good for sequential processing)

Respond in JSON:
{
  "proposedType": "one of the topologies",
  "agentCount": recommended number,
  "coordinationPattern": "how agents coordinate",
  "reason": "why this topology is better",
  "expectedImprovement": 0-100,
  "confidence": 0-100
}`;

export class ApexEvolution {
  private patches: HarnessPatch[] = [];
  private principles: Map<string, Principle> = new Map();
  private currentTopology: TopologyConfig;
  private cycle = 0;
  private maxPatches = 100;
  private maxPrinciples = 200;
  private totalImprovement = 0;

  constructor(private llm?: LlmProvider) {
    this.currentTopology = {
      type: 'single-agent',
      agentCount: 1,
      coordinationPattern: 'direct',
      communicationOverhead: 0,
      expectedThroughput: 1,
      expectedLatency: 100,
    };
    log.info('ApexEvolution initialized — 3-layer co-evolution');
  }

  // ===== Layer 1: Harness Patching =====

  async proposePatch(
    targetModule: string,
    currentPerformance: number,
    issues: string[],
  ): Promise<HarnessPatch | null> {
    if (!this.llm) return null;

    try {
      const response = await this.llm.complete([
        { role: 'system', content: 'You are a harness patching module. Propose a minimal, reversible code patch. Respond in JSON with: targetModule, patchDescription, patchCode, expectedGain (0-100), riskLevel.' },
        {
          role: 'user',
          content: JSON.stringify({ targetModule, currentPerformance, issues, cycle: this.cycle }),
        },
      ], { temperature: 0.2, maxTokens: 800 });

      const parsed = this.parsePatch(response.content, targetModule, currentPerformance);
      if (parsed) {
        this.patches.push(parsed);
        if (this.patches.length > this.maxPatches) {
          this.patches = this.patches.slice(-this.maxPatches);
        }
        apRepo.insert(parsed.id, { cycle: this.cycle, description: parsed.patchDescription, patch: parsed.patchCode, applied: parsed.applied, performance_gain: parsed.expectedGain }).catch((err) => log.error({ err }, 'DB write failed'));
        incCounter('apex_patch_proposed', 'APEX harness patches proposed', 1);
        log.info({ target: targetModule, risk: parsed.riskLevel }, 'harness patch proposed');
      }
      return parsed;
    } catch (err) {
      log.error({ err }, 'harness patch proposal failed');
      return null;
    }
  }

  recordPatchResult(patchId: string, applied: boolean, performanceAfter: number, reverted: boolean): void {
    const patch = this.patches.find(p => p.id === patchId);
    if (!patch) return;
    patch.applied = applied;
    patch.reverted = reverted;
    patch.performanceAfter = performanceAfter;
    if (applied && !reverted) {
      const gain = performanceAfter - patch.performanceBefore;
      this.totalImprovement += gain;
      incCounter('apex_patch_applied', 'APEX patches applied', 1);
    }
    if (reverted) {
      incCounter('apex_patch_reverted', 'APEX patches reverted', 1);
    }
  }

  // ===== Layer 2: Principle Distillation =====

  async extractPrinciples(runs: AgentRun[]): Promise<PrincipleExtractionResult> {
    if (runs.length === 0) {
      return { principles: [], fromRunCount: 0, patternsIdentified: [] };
    }

    // Heuristic extraction from successful vs failed runs
    const successful = runs.filter(r => r.status === 'completed' && r.finalAnswer && !r.finalAnswer.includes('error'));
    const failed = runs.filter(r => r.status === 'failed');

    const patterns: string[] = [];
    const extracted: Principle[] = [];

    // Pattern: successful runs with fewer steps are more efficient
    if (successful.length > 5) {
      const avgStepsSuccess = successful.reduce((s, r) => s + r.currentStep, 0) / successful.length;
      const avgStepsFailed = failed.length > 0 ? failed.reduce((s, r) => s + r.currentStep, 0) / failed.length : 0;
      if (avgStepsSuccess < avgStepsFailed) {
        patterns.push('Fewer steps correlate with success');
        const principle = this.makePrinciple(
          'Efficiency Principle',
          'Minimize steps — fewer, more targeted actions lead to better outcomes',
          'efficiency',
          successful.map(r => r.id),
          75,
          'Step count analysis across successful vs failed runs',
        );
        if (!this.principles.has(principle.name)) {
          this.principles.set(principle.name, principle);
          aprRepo.upsert(principle.name, principle.description, principle.sourceRuns.length).catch((err) => log.error({ err }, 'DB write failed'));
        }
        extracted.push(principle);
      }
    }

    // Pattern: tool usage diversity
    if (successful.length > 3) {
      const toolDiversity = successful.map(r => new Set(r.steps.filter(s => s.action).map(s => s.action!.name)).size);
      const avgDiversity = toolDiversity.reduce((s, v) => s + v, 0) / toolDiversity.length;
      if (avgDiversity > 2) {
        patterns.push('Tool diversity correlates with success');
        const principle = this.makePrinciple(
          'Tool Diversity Principle',
          'Use diverse tools rather than repeating the same tool — different tools provide different perspectives',
          'accuracy',
          successful.slice(0, 10).map(r => r.id),
          65,
          'Tool usage analysis across successful runs',
        );
        if (!this.principles.has(principle.name)) {
          this.principles.set(principle.name, principle);
          aprRepo.upsert(principle.name, principle.description, principle.sourceRuns.length).catch((err) => log.error({ err }, 'DB write failed'));
        }
        extracted.push(principle);
      }
    }

    // LLM-based deep extraction
    if (this.llm && runs.length >= 3) {
      try {
        const response = await this.llm.complete([
          { role: 'system', content: PRINCIPLE_EXTRACTION_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              runs: runs.slice(-10).map(r => ({
                status: r.status,
                prompt: r.prompt.slice(0, 200),
                steps: r.currentStep,
                toolsUsed: r.steps.filter(s => s.action).map(s => s.action!.name),
                finalAnswer: r.finalAnswer?.slice(0, 200),
              })),
            }),
          },
        ], { temperature: 0.3, maxTokens: 800 });

        const parsed = this.parsePrinciples(response.content, runs);
        for (const p of parsed) {
          if (!this.principles.has(p.name)) {
            this.principles.set(p.name, p);
            extracted.push(p);
          }
        }
      } catch (err) {
        log.error({ err }, 'LLM principle extraction failed');
      }
    }

    // Trim if over limit
    if (this.principles.size > this.maxPrinciples) {
      const sorted = Array.from(this.principles.entries())
        .sort((a, b) => b[1].confidence - a[1].confidence);
      this.principles = new Map(sorted.slice(0, this.maxPrinciples));
    }

    incCounter('apex_principles_extracted', 'APEX principles extracted', extracted.length);
    log.info({ extracted: extracted.length, patterns: patterns.length, total: this.principles.size }, 'principles extracted');

    return {
      principles: extracted,
      fromRunCount: runs.length,
      patternsIdentified: patterns,
    };
  }

  applyPrinciple(name: string, success: boolean): void {
    const principle = this.principles.get(name);
    if (!principle) return;
    principle.timesApplied++;
    const total = principle.timesApplied;
    principle.successRate = ((principle.successRate * (total - 1)) + (success ? 100 : 0)) / total;
    principle.updatedAt = new Date();
    incCounter('apex_principle_applied', 'APEX principle applications', 1, { success: success ? 'true' : 'false' });
  }

  getPrinciples(category?: Principle['category']): Principle[] {
    const all = Array.from(this.principles.values());
    return category ? all.filter(p => p.category === category) : all;
  }

  getTopPrinciples(count: number = 10): Principle[] {
    return Array.from(this.principles.values())
      .sort((a, b) => b.confidence * b.successRate - a.confidence * a.successRate)
      .slice(0, count);
  }

  // ===== Layer 3: Topology Evolution =====

  async evolveTopology(
    taskPatterns: { complexity: number; parallelism: number; sequentiality: number },
  ): Promise<TopologyEvolutionResult | null> {
    // Heuristic topology selection
    const heuristic = this.heuristicTopology(taskPatterns);

    if (this.llm) {
      try {
        const response = await this.llm.complete([
          { role: 'system', content: TOPOLOGY_ANALYSIS_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              currentTopology: this.currentTopology,
              taskPatterns,
              cycle: this.cycle,
            }),
          },
        ], { temperature: 0.2, maxTokens: 500 });

        const parsed = this.parseTopology(response.content);
        if (parsed) {
          const result: TopologyEvolutionResult = {
            currentTopology: this.currentTopology,
            proposedTopology: parsed,
            reason: parsed.coordinationPattern,
            expectedImprovement: parsed.expectedThroughput - this.currentTopology.expectedThroughput,
            confidence: 80,
            applied: false,
          };
          incCounter('apex_topology_proposed', 'APEX topology changes proposed', 1);
          log.info({ from: this.currentTopology.type, to: parsed.type }, 'topology evolution proposed');
          return result;
        }
      } catch (err) {
        log.error({ err }, 'LLM topology analysis failed');
      }
    }

    // Use heuristic result
    if (heuristic.type !== this.currentTopology.type) {
      const result: TopologyEvolutionResult = {
        currentTopology: this.currentTopology,
        proposedTopology: heuristic,
        reason: `Heuristic: complexity=${taskPatterns.complexity}, parallelism=${taskPatterns.parallelism}`,
        expectedImprovement: heuristic.expectedThroughput - this.currentTopology.expectedThroughput,
        confidence: 60,
        applied: false,
      };
      return result;
    }

    return null;
  }

  applyTopology(result: TopologyEvolutionResult): void {
    this.currentTopology = result.proposedTopology;
    result.applied = true;
    incCounter('apex_topology_applied', 'APEX topology changes applied', 1, { type: result.proposedTopology.type });
    log.info({ type: result.proposedTopology.type }, 'topology evolved');
  }

  getCurrentTopology(): TopologyConfig {
    return { ...this.currentTopology };
  }

  // ===== Combined Evolution Cycle =====

  async runEvolutionCycle(
    runs: AgentRun[],
    performanceMetrics?: { successRate: number; avgLatency: number; avgTokens: number },
  ): Promise<ApexEvolutionResult> {
    this.cycle++;
    incCounter('apex_cycle', 'APEX evolution cycles', 1);

    // Layer 1: Propose patches based on performance issues
    const patches: HarnessPatch[] = [];
    if (performanceMetrics && performanceMetrics.successRate < 0.8) {
      const patch = await this.proposePatch(
        'agent-runner',
        performanceMetrics.successRate * 100,
        [`Success rate: ${performanceMetrics.successRate}`, `Avg latency: ${performanceMetrics.avgLatency}ms`],
      );
      if (patch) patches.push(patch);
    }

    // Layer 2: Extract principles from runs
    const principleResult = await this.extractPrinciples(runs);

    // Layer 3: Evolve topology based on run patterns
    let topologyResult: TopologyEvolutionResult | undefined;
    if (runs.length > 0) {
      const avgSteps = runs.reduce((s, r) => s + r.currentStep, 0) / runs.length;
      const toolDiversity = new Set(
        runs.flatMap(r => r.steps.filter(s => s.action).map(s => s.action!.name)),
      ).size;
      const topology = await this.evolveTopology({
        complexity: Math.min(1, avgSteps / 10),
        parallelism: Math.min(1, toolDiversity / 10),
        sequentiality: Math.min(1, avgSteps / 20),
      });
      if (topology) {
        topologyResult = topology;
        this.applyTopology(topology);
      }
    }

    const overallImprovement = this.totalImprovement / Math.max(1, this.cycle);

    log.info({ cycle: this.cycle, patches: patches.length, principles: principleResult.principles.length, topology: topologyResult?.proposedTopology.type }, 'evolution cycle complete');

    return {
      layer1Patches: patches,
      layer2Principles: principleResult.principles,
      layer3Topology: topologyResult,
      overallImprovement,
      cycle: this.cycle,
    };
  }

  // ===== Stats =====

  stats(): ApexStats {
    const applied = this.patches.filter(p => p.applied && !p.reverted);
    const reverted = this.patches.filter(p => p.reverted);
    const principleApps = Array.from(this.principles.values()).reduce((s, p) => s + p.timesApplied, 0);

    return {
      totalCycles: this.cycle,
      totalPatches: this.patches.length,
      appliedPatches: applied.length,
      revertedPatches: reverted.length,
      totalPrinciples: this.principles.size,
      principleApplications: principleApps,
      topologyChanges: 0,
      avgImprovement: this.cycle > 0 ? Math.round((this.totalImprovement / this.cycle) * 10) / 10 : 0,
    };
  }

  clear(): void {
    this.patches = [];
    this.principles.clear();
    this.cycle = 0;
    this.totalImprovement = 0;
  }

  // ===== Private Helpers =====

  private makePrinciple(
    name: string,
    description: string,
    category: Principle['category'],
    sourceRuns: string[],
    confidence: number,
    extractedFrom: string,
  ): Principle {
    return {
      id: randomUUID().slice(0, 8),
      name,
      description,
      category,
      sourceRuns,
      confidence,
      timesApplied: 0,
      successRate: 50,
      extractedFrom,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private parsePatch(content: string, targetModule: string, performanceBefore: number): HarnessPatch | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const raw = JSON.parse(jsonMatch[0]);
      return {
        id: randomUUID().slice(0, 8),
        targetModule: String(raw.targetModule ?? targetModule),
        patchDescription: String(raw.patchDescription ?? raw.description ?? ''),
        patchCode: String(raw.patchCode ?? raw.code ?? ''),
        expectedGain: Math.max(0, Math.min(100, Number(raw.expectedGain ?? 0))),
        riskLevel: (raw.riskLevel as HarnessPatch['riskLevel']) ?? 'medium',
        applied: false,
        reverted: false,
        performanceBefore,
        performanceAfter: performanceBefore,
        createdAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  private parsePrinciples(content: string, runs: AgentRun[]): Principle[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      const raw = JSON.parse(jsonMatch[0]);
      const principlesRaw = Array.isArray(raw.principles) ? raw.principles : [];
      return principlesRaw.map((p: Record<string, unknown>) => this.makePrinciple(
        String(p.name ?? 'Unknown'),
        String(p.description ?? ''),
        (p.category as Principle['category']) ?? 'reasoning',
        runs.slice(-5).map(r => r.id),
        Math.max(0, Math.min(100, Number(p.confidence ?? 50))),
        String(p.extractedFrom ?? 'LLM extraction'),
      ));
    } catch {
      return [];
    }
  }

  private parseTopology(content: string): TopologyConfig | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const raw = JSON.parse(jsonMatch[0]);
      const type = (raw.proposedType as TopologyType) ?? 'single-agent';
      const agentCount = Math.max(1, Math.min(20, Number(raw.agentCount ?? 1)));
      return {
        type,
        agentCount,
        coordinationPattern: String(raw.coordinationPattern ?? 'direct'),
        communicationOverhead: agentCount > 1 ? agentCount * 5 : 0,
        expectedThroughput: agentCount > 1 ? agentCount * 0.8 : 1,
        expectedLatency: type === 'single-agent' ? 100 : 100 + agentCount * 20,
      };
    } catch {
      return null;
    }
  }

  private heuristicTopology(patterns: { complexity: number; parallelism: number; sequentiality: number }): TopologyConfig {
    if (patterns.parallelism > 0.7 && patterns.complexity > 0.5) {
      return { type: 'orchestrator-worker', agentCount: 4, coordinationPattern: 'delegation', communicationOverhead: 20, expectedThroughput: 3.2, expectedLatency: 180 };
    }
    if (patterns.complexity > 0.8) {
      return { type: 'hierarchical', agentCount: 6, coordinationPattern: 'tree', communicationOverhead: 30, expectedThroughput: 2.5, expectedLatency: 220 };
    }
    if (patterns.parallelism > 0.6 && patterns.sequentiality < 0.3) {
      return { type: 'swarm', agentCount: 5, coordinationPattern: 'broadcast', communicationOverhead: 25, expectedThroughput: 4.0, expectedLatency: 200 };
    }
    if (patterns.sequentiality > 0.7) {
      return { type: 'pipeline', agentCount: 3, coordinationPattern: 'stages', communicationOverhead: 15, expectedThroughput: 2.0, expectedLatency: 150 };
    }
    return { type: 'single-agent', agentCount: 1, coordinationPattern: 'direct', communicationOverhead: 0, expectedThroughput: 1, expectedLatency: 100 };
  }
}
