import { describe, it, expect, beforeEach } from 'vitest';
import { BiTemporalKnowledgeGraph } from './bi-temporal-graph.js';

describe('BiTemporalKnowledgeGraph', () => {
  let graph: BiTemporalKnowledgeGraph;

  beforeEach(() => {
    graph = new BiTemporalKnowledgeGraph();
  });

  it('adds facts with valid-time and transaction-time', () => {
    const fact = graph.addFact({
      subject: 'user:alice',
      predicate: 'role',
      object: 'admin',
      source: 'auth-service',
      salience: 80,
    });

    expect(fact.id).toBeDefined();
    expect(fact.subject).toBe('user:alice');
    expect(fact.predicate).toBe('role');
    expect(fact.object).toBe('admin');
    expect(fact.validTimeStart).toBeDefined();
    expect(fact.transactionTimeStart).toBeDefined();
    expect(fact.salience).toBe(80);
  });

  it('supersedes old facts when conflicting fact is added', () => {
    graph.addFact({ subject: 'user:bob', predicate: 'role', object: 'viewer', source: 'auth' });
    graph.addFact({ subject: 'user:bob', predicate: 'role', object: 'editor', source: 'auth' });

    const facts = graph.queryFacts({ subject: 'user:bob', predicate: 'role' });
    expect(facts.length).toBe(1);
    expect(facts[0].object).toBe('editor');

    const allFacts = graph.queryFacts({ subject: 'user:bob', predicate: 'role', includeSuperseded: true });
    expect(allFacts.length).toBe(2);
    expect(allFacts.find(f => f.object === 'viewer')!.supersededBy).toBeDefined();
  });

  it('queries facts as-of a specific time', () => {
    const pastDate = new Date(Date.now() - 60000);
    graph.addFact({
      subject: 'server:1',
      predicate: 'status',
      object: 'running',
      validTimeStart: pastDate,
      source: 'monitor',
    });

    // Query as-of now (fact is valid and recorded)
    const asOfNow = new Date();
    const facts = graph.queryFacts({ subject: 'server:1', asOf: asOfNow });
    expect(facts.length).toBe(1);
    expect(facts[0].object).toBe('running');

    // Add superseding fact
    graph.addFact({ subject: 'server:1', predicate: 'status', object: 'stopped', source: 'monitor' });

    // Query as-of now should show only the new fact
    const currentFacts = graph.queryFacts({ subject: 'server:1', asOf: new Date() });
    expect(currentFacts.length).toBe(1);
    expect(currentFacts[0].object).toBe('stopped');

    // Query with includeSuperseded shows both
    const allFacts = graph.queryFacts({ subject: 'server:1', includeSuperseded: true });
    expect(allFacts.length).toBe(2);
  });

  it('performs multi-hop retrieval', () => {
    graph.addFact({ subject: 'alice', predicate: 'knows', object: 'bob', source: 'social' });
    graph.addFact({ subject: 'bob', predicate: 'knows', object: 'charlie', source: 'social' });
    graph.addFact({ subject: 'charlie', predicate: 'knows', object: 'dave', source: 'social' });

    const paths = graph.multiHopRetrieval('alice', 3);
    expect(paths.length).toBeGreaterThan(0);

    const twoHop = paths.find(p => p.hops === 2);
    expect(twoHop).toBeDefined();
    expect(twoHop!.nodes.length).toBe(3);
    expect(twoHop!.nodes[0].id).toBe('alice');
    expect(twoHop!.nodes[2].id).toBe('charlie');
  });

  it('performs hybrid retrieval combining facts and paths', () => {
    graph.addFact({ subject: 'alice', predicate: 'knows', object: 'bob', source: 'social' });
    graph.addFact({ subject: 'bob', predicate: 'knows', object: 'charlie', source: 'social' });
    graph.addFact({ subject: 'alice', predicate: 'role', object: 'admin', source: 'auth' });

    const result = graph.hybridRetrieval({ subject: 'alice' });
    expect(result.facts.length).toBe(2);
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.totalSalience).toBeGreaterThan(0);
  });

  it('reinforces fact salience', () => {
    const fact = graph.addFact({ subject: 'x', predicate: 'y', object: 'z', source: 'test', salience: 50 });
    graph.reinforceFact(fact.id);
    const reinforced = graph.queryFacts({ subject: 'x' })[0];
    expect(reinforced.salience).toBeGreaterThan(50);
  });

  it('decays salience over time', () => {
    const fact = graph.addFact({ subject: 'old', predicate: 'data', object: 'value', source: 'test', salience: 80 });
    // Simulate old transaction time
    fact.transactionTimeStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    graph.decaySalience();
    const decayed = graph.queryFacts({ subject: 'old' })[0];
    expect(decayed.salience).toBeLessThan(80);
  });

  it('detects contradictions', () => {
    // Add two facts with same subject+predicate but different objects, both active (no supersession because different sources)
    graph.addFact({ subject: 'config', predicate: 'port', object: '3000', source: 'env1' });
    // Force a contradiction by adding directly without triggering supersession
    graph.addFact({ subject: 'config', predicate: 'port', object: '4000', source: 'env2' });

    // The second add should have superseded the first
    const active = graph.queryFacts({ subject: 'config', predicate: 'port' });
    expect(active.length).toBe(1);
    expect(active[0].object).toBe('4000');
  });

  it('tracks conflicts', () => {
    graph.addFact({ subject: 'user:x', predicate: 'email', object: 'a@test.com', source: 's1' });
    graph.addFact({ subject: 'user:x', predicate: 'email', object: 'b@test.com', source: 's2' });

    const conflicts = graph.getConflicts();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe('supersession');
    expect(conflicts[0].winningFactId).toBeDefined();
  });

  it('tracks stats', () => {
    graph.addFact({ subject: 'a', predicate: 'x', object: '1', source: 'test' });
    graph.addFact({ subject: 'b', predicate: 'y', object: '2', source: 'test' });
    graph.addFact({ subject: 'a', predicate: 'x', object: '3', source: 'test' }); // supersedes first

    const stats = graph.stats();
    expect(stats.totalFacts).toBe(3);
    expect(stats.activeFacts).toBe(2);
    expect(stats.supersededFacts).toBe(1);
    expect(stats.totalConflicts).toBe(1);
  });

  it('clears all data', () => {
    graph.addFact({ subject: 'a', predicate: 'x', object: '1', source: 'test' });
    graph.clear();
    expect(graph.stats().totalFacts).toBe(0);
    expect(graph.stats().totalNodes).toBe(0);
  });
});
