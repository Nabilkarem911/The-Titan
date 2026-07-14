import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import { incCounter, setGauge } from '@titan/observability';

const log = getLogger().child({ component: 'bi-temporal-graph' });

interface BiTemporalFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  value: unknown;
  validTimeStart: Date;
  validTimeEnd?: Date;
  transactionTimeStart: Date;
  transactionTimeEnd?: Date;
  supersededBy?: string;
  salience: number;
  source: string;
  metadata?: Record<string, unknown>;
}

interface ConflictRecord {
  id: string;
  factIds: string[];
  type: 'contradiction' | 'supersession' | 'duplicate';
  resolvedAt: Date;
  resolution: string;
  winningFactId: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  salience: number;
  lastUpdated: Date;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
  validTimeStart: Date;
  validTimeEnd?: Date;
  properties?: Record<string, unknown>;
}

interface MultiHopPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalWeight: number;
  hops: number;
}

interface RetrievalResult {
  facts: BiTemporalFact[];
  paths: MultiHopPath[];
  nodes: GraphNode[];
  totalSalience: number;
}

export class BiTemporalKnowledgeGraph {
  private facts: Map<string, BiTemporalFact> = new Map();
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private conflicts: ConflictRecord[] = [];
  private maxFacts = 10000;
  private salienceDecayRate = 0.95;
  private salienceReinforcement = 1.15;

  constructor() {}

  // ===== Fact Management =====

  addFact(params: {
    subject: string;
    predicate: string;
    object: string;
    value?: unknown;
    validTimeStart?: Date;
    source: string;
    salience?: number;
    metadata?: Record<string, unknown>;
  }): BiTemporalFact {
    const now = new Date();
    const fact: BiTemporalFact = {
      id: randomUUID().slice(0, 12),
      subject: params.subject,
      predicate: params.predicate,
      object: params.object,
      value: params.value ?? true,
      validTimeStart: params.validTimeStart ?? now,
      transactionTimeStart: now,
      salience: params.salience ?? 50,
      source: params.source,
      metadata: params.metadata,
    };

    // Check for conflicts — existing facts with same subject+predicate
    const existing = this.findConflictingFacts(fact);
    if (existing.length > 0) {
      this.resolveConflict(fact, existing);
    }

    this.facts.set(fact.id, fact);

    // Update nodes and edges
    this.ensureNode(fact.subject, 'entity');
    this.ensureNode(fact.object, 'entity');
    this.ensureEdge(fact.subject, fact.object, fact.predicate, fact.salience, fact.validTimeStart);

    // Enforce max size
    if (this.facts.size > this.maxFacts) {
      const lowestSalience = Array.from(this.facts.values())
        .sort((a, b) => a.salience - b.salience)[0];
      if (lowestSalience) {
        this.facts.delete(lowestSalience.id);
      }
    }

    incCounter('bitemporal_fact_added', 'Bi-temporal facts added', 1);
    log.debug({ factId: fact.id, subject: fact.subject, predicate: fact.predicate }, 'fact added');
    return fact;
  }

  // ===== Conflict Resolution =====

  private findConflictingFacts(newFact: BiTemporalFact): BiTemporalFact[] {
    return Array.from(this.facts.values()).filter(f =>
      f.subject === newFact.subject &&
      f.predicate === newFact.predicate &&
      f.object !== newFact.object &&
      f.transactionTimeEnd === undefined &&
      f.supersededBy === undefined,
    );
  }

  private resolveConflict(newFact: BiTemporalFact, existing: BiTemporalFact[]): void {
    // Supersession: new fact supersedes existing facts
    const now = new Date();
    for (const old of existing) {
      old.transactionTimeEnd = now;
      old.supersededBy = newFact.id;
      old.validTimeEnd = now;
    }

    const conflict: ConflictRecord = {
      id: randomUUID().slice(0, 8),
      factIds: [newFact.id, ...existing.map(f => f.id)],
      type: 'supersession',
      resolvedAt: now,
      resolution: `New fact from ${newFact.source} supersedes ${existing.length} existing fact(s)`,
      winningFactId: newFact.id,
    };
    this.conflicts.push(conflict);
    incCounter('bitemporal_conflict_resolved', 'Bi-temporal conflicts resolved', 1, { type: 'supersession' });
    log.info({ conflictId: conflict.id, superseded: existing.length }, 'conflict resolved via supersession');
  }

  // ===== Bi-Temporal Queries =====

  queryFacts(params: {
    subject?: string;
    predicate?: string;
    object?: string;
    asOf?: Date;
    includeSuperseded?: boolean;
  }): BiTemporalFact[] {
    const { subject, predicate, object, asOf, includeSuperseded } = params;

    return Array.from(this.facts.values()).filter(f => {
      if (subject && f.subject !== subject) return false;
      if (predicate && f.predicate !== predicate) return false;
      if (object && f.object !== object) return false;
      if (!includeSuperseded && f.supersededBy !== undefined) return false;

      if (asOf) {
        // Bi-temporal query: fact must be valid and recorded as of this time
        const validAtAsOf = f.validTimeStart <= asOf && (f.validTimeEnd === undefined || f.validTimeEnd > asOf);
        const recordedAtAsOf = f.transactionTimeStart <= asOf && (f.transactionTimeEnd === undefined || f.transactionTimeEnd > asOf);
        if (!validAtAsOf || !recordedAtAsOf) return false;
      }

      return true;
    }).sort((a, b) => b.salience - a.salience);
  }

  // ===== Multi-Hop Retrieval =====

  multiHopRetrieval(startNode: string, maxHops = 3, minSalience = 10): MultiHopPath[] {
    const paths: MultiHopPath[] = [];
    const start = this.nodes.get(startNode);
    if (!start) return paths;

    this.dfsTraversal(startNode, [], [], [], maxHops, minSalience, paths);
    return paths.sort((a, b) => a.totalWeight - b.totalWeight);
  }

  private dfsTraversal(
    current: string,
    visitedNodes: string[],
    accumulatedNodes: GraphNode[],
    accumulatedEdges: GraphEdge[],
    maxHops: number,
    minSalience: number,
    results: MultiHopPath[],
  ): void {
    if (visitedNodes.length >= maxHops) return;
    if (visitedNodes.includes(current)) return;

    const node = this.nodes.get(current);
    if (!node) return;
    if (node.salience < minSalience && visitedNodes.length > 0) return;

    const newNodes = [...accumulatedNodes, node];
    const newVisited = [...visitedNodes, current];

    if (newVisited.length > 1) {
      results.push({
        nodes: newNodes,
        edges: [...accumulatedEdges],
        totalWeight: accumulatedEdges.reduce((s, e) => s + e.weight, 0),
        hops: newVisited.length - 1,
      });
    }

    // Traverse edges
    const outEdges = Array.from(this.edges.values()).filter(
      e => e.source === current && e.validTimeEnd === undefined,
    );

    for (const edge of outEdges) {
      const targetNode = this.nodes.get(edge.target);
      if (!targetNode) continue;
      this.dfsTraversal(
        edge.target,
        newVisited,
        newNodes,
        [...accumulatedEdges, edge],
        maxHops,
        minSalience,
        results,
      );
    }
  }

  // ===== Hybrid Retrieval (facts + graph paths) =====

  hybridRetrieval(query: {
    subject?: string;
    predicate?: string;
    object?: string;
    startNode?: string;
    maxHops?: number;
    minSalience?: number;
    asOf?: Date;
  }): RetrievalResult {
    const facts = this.queryFacts({
      subject: query.subject,
      predicate: query.predicate,
      object: query.object,
      asOf: query.asOf,
    });

    const startNode = query.startNode ?? query.subject ?? '';
    const paths = startNode ? this.multiHopRetrieval(startNode, query.maxHops ?? 3, query.minSalience ?? 10) : [];

    const nodeIds = new Set<string>();
    facts.forEach(f => { nodeIds.add(f.subject); nodeIds.add(f.object); });
    paths.forEach(p => p.nodes.forEach(n => nodeIds.add(n.id)));

    const nodes = Array.from(nodeIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined)
      .sort((a, b) => b.salience - a.salience);

    const totalSalience = facts.reduce((s, f) => s + f.salience, 0) + nodes.reduce((s, n) => s + n.salience, 0);

    setGauge('bitemporal_retrieval_results', 'Retrieval result count', facts.length + paths.length);

    return { facts, paths, nodes, totalSalience };
  }

  // ===== Salience Management =====

  reinforceFact(factId: string): void {
    const fact = this.facts.get(factId);
    if (!fact) return;
    fact.salience = Math.min(100, fact.salience * this.salienceReinforcement);

    const node = this.nodes.get(fact.subject);
    if (node) {
      node.salience = Math.min(100, node.salience * this.salienceReinforcement);
      node.lastUpdated = new Date();
    }
    incCounter('bitemporal_fact_reinforced', 'Facts reinforced', 1);
  }

  decaySalience(): void {
    const now = new Date();
    for (const fact of this.facts.values()) {
      if (fact.supersededBy) continue;
      const ageDays = (now.getTime() - fact.transactionTimeStart.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) {
        fact.salience = Math.max(0, fact.salience * this.salienceDecayRate);
      }
    }
    for (const node of this.nodes.values()) {
      const ageDays = (now.getTime() - node.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) {
        node.salience = Math.max(0, node.salience * this.salienceDecayRate);
      }
    }
    incCounter('bitemporal_salience_decay', 'Salience decay cycles', 1);
  }

  // ===== Node/Edge Helpers =====

  private ensureNode(label: string, type: string): void {
    if (!this.nodes.has(label)) {
      this.nodes.set(label, {
        id: label,
        label,
        type,
        properties: {},
        salience: 50,
        lastUpdated: new Date(),
      });
    } else {
      const node = this.nodes.get(label)!;
      node.salience = Math.min(100, node.salience + 1);
      node.lastUpdated = new Date();
    }
  }

  private ensureEdge(source: string, target: string, relation: string, weight: number, validStart: Date): void {
    const edgeId = `${source}:${relation}:${target}`;
    if (!this.edges.has(edgeId)) {
      this.edges.set(edgeId, {
        id: edgeId,
        source,
        target,
        relation,
        weight,
        validTimeStart: validStart,
      });
    }
  }

  // ===== Contradiction Detection =====

  detectContradictions(): ConflictRecord[] {
    const contradictions: ConflictRecord[] = [];
    const groups = new Map<string, BiTemporalFact[]>();

    for (const fact of this.facts.values()) {
      if (fact.supersededBy) continue;
      const key = `${fact.subject}:${fact.predicate}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(fact);
    }

    for (const [key, facts] of groups) {
      const uniqueObjects = new Set(facts.map(f => f.object));
      if (uniqueObjects.size > 1) {
        contradictions.push({
          id: randomUUID().slice(0, 8),
          factIds: facts.map(f => f.id),
          type: 'contradiction',
          resolvedAt: new Date(),
          resolution: `Unresolved contradiction: ${key} has ${uniqueObjects.size} different values`,
          winningFactId: facts.sort((a, b) => b.salience - a.salience)[0].id,
        });
      }
    }

    return contradictions;
  }

  // ===== Stats =====

  stats(): {
    totalFacts: number;
    activeFacts: number;
    supersededFacts: number;
    totalNodes: number;
    totalEdges: number;
    totalConflicts: number;
    avgSalience: number;
  } {
    const active = Array.from(this.facts.values()).filter(f => !f.supersededBy);
    const superseded = Array.from(this.facts.values()).filter(f => f.supersededBy);
    const avgSalience = active.length > 0
      ? Math.round(active.reduce((s, f) => s + f.salience, 0) / active.length)
      : 0;

    setGauge('bitemporal_total_facts', 'Total facts', this.facts.size);
    setGauge('bitemporal_active_facts', 'Active facts', active.length);
    setGauge('bitemporal_nodes', 'Graph nodes', this.nodes.size);

    return {
      totalFacts: this.facts.size,
      activeFacts: active.length,
      supersededFacts: superseded.length,
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      totalConflicts: this.conflicts.length,
      avgSalience,
    };
  }

  getConflicts(): ConflictRecord[] {
    return this.conflicts;
  }

  clear(): void {
    this.facts.clear();
    this.nodes.clear();
    this.edges.clear();
    this.conflicts = [];
  }
}
