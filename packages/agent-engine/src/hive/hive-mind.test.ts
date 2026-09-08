import { describe, it, expect, beforeEach } from 'vitest';
import { HiveMind } from './hive-mind.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('HiveMind', () => {
  let hive: HiveMind;

  beforeEach(() => {
    hive = new HiveMind(new MockEchoProvider());
  });

  it('should register self on construction', () => {
    expect(hive.getInstances().length).toBeGreaterThanOrEqual(1);
    expect(hive.getSelfId()).toBeDefined();
  });

  it('should register additional instances', () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: ['coding'], specialization: null });
    expect(hive.getInstances().length).toBe(2);
  });

  it('should unregister instances', () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    hive.unregisterInstance('node-2');
    expect(hive.getInstances().find((i) => i.id === 'node-2')).toBeUndefined();
  });

  it('should update lastSeen on heartbeat', () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    const before = hive.getInstances().find((i) => i.id === 'node-2')!.lastSeen;
    hive.heartbeat('node-2');
    const after = hive.getInstances().find((i) => i.id === 'node-2')!.lastSeen;
    expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('should get online instances within max age', () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    const online = hive.getOnlineInstances(60000);
    expect(online.length).toBe(2);
  });

  it('should share knowledge', () => {
    hive.shareKnowledge('coding:pattern:mvc', { description: 'Model-View-Controller' });
    const knowledge = hive.getKnowledge('coding:pattern:mvc');
    expect(knowledge).toBeDefined();
    expect(knowledge!.value).toBeDefined();
    expect(knowledge!.version).toBe(1);
  });

  it('should increment knowledge version on update', () => {
    hive.shareKnowledge('test:key', { v: 1 });
    hive.shareKnowledge('test:key', { v: 2 });
    const knowledge = hive.getKnowledge('test:key');
    expect(knowledge!.version).toBe(2);
  });

  it('should merge remote knowledge with higher version', () => {
    hive.shareKnowledge('test:key', { v: 1 });
    const merged = hive.mergeKnowledge([{
      id: 'remote-1',
      key: 'test:key',
      value: { v: 2 },
      originInstance: 'remote-node',
      timestamp: new Date(),
      version: 5,
      confidence: 0.9,
    }]);
    expect(merged).toBe(1);
    expect(hive.getKnowledge('test:key')!.version).toBe(5);
  });

  it('should not merge remote knowledge with lower version', () => {
    hive.shareKnowledge('test:key', { v: 1 });
    // Update to version 10
    for (let i = 0; i < 9; i++) {
      hive.shareKnowledge('test:key', { v: i + 2 });
    }
    const merged = hive.mergeKnowledge([{
      id: 'remote-1',
      key: 'test:key',
      value: { v: 0 },
      originInstance: 'remote-node',
      timestamp: new Date(),
      version: 3,
      confidence: 0.5,
    }]);
    expect(merged).toBe(0);
  });

  it('should propose and cast votes', async () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    hive.registerInstance({ id: 'node-3', hostname: 'server3', capabilities: [], specialization: null });

    const vote = await hive.proposeVote('test topic', 'test proposal');
    expect(vote.votes).toHaveLength(1); // self vote

    hive.castVote(vote.id, 'node-2', 'yes', 'agree');
    hive.castVote(vote.id, 'node-3', 'no', 'disagree');
    expect(vote.votes).toHaveLength(3);
  });

  it('should not allow double voting', async () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    const vote = await hive.proposeVote('test', 'proposal');
    const result1 = hive.castVote(vote.id, 'node-2', 'yes', 'agree');
    const result2 = hive.castVote(vote.id, 'node-2', 'no', 'changed mind');
    expect(result1).toBe(true);
    expect(result2).toBe(false);
  });

  it('should check quorum and pass vote', async () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    const vote = await hive.proposeVote('test', 'proposal');
    hive.castVote(vote.id, 'node-2', 'yes', 'agree');
    hive.checkQuorum(vote.id);
    // 2 online, 2 yes votes, quorum 51% = 2 needed
    expect(vote.passed).toBe(true);
  });

  it('should check quorum and fail vote', async () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    hive.registerInstance({ id: 'node-3', hostname: 'server3', capabilities: [], specialization: null });
    const vote = await hive.proposeVote('test', 'proposal');
    hive.castVote(vote.id, 'node-2', 'no', 'disagree');
    hive.castVote(vote.id, 'node-3', 'no', 'disagree');
    hive.checkQuorum(vote.id);
    // 3 online, 3 votes (1 yes, 2 no), quorum met, majority no
    expect(vote.passed).toBe(false);
  });

  it('should get active votes', async () => {
    await hive.proposeVote('test', 'proposal');
    const active = hive.getActiveVotes();
    expect(active.length).toBe(1);
  });

  it('should create initial constitution with articles', () => {
    const constitution = hive.getConstitution();
    expect(constitution.articles.length).toBeGreaterThan(0);
    expect(constitution.articles.some((a) => a.id === 'safety')).toBe(true);
    expect(constitution.articles.find((a) => a.id === 'safety')!.immutable).toBe(true);
  });

  it('should amend non-immutable articles', async () => {
    const amendment = await hive.proposeConstitutionAmendment('cooperation', 'Updated cooperation rules');
    expect(amendment.vote.passed).toBe(true); // auto-pass with single instance
    expect(amendment.amendment).not.toBeNull();
    const constitution = hive.getConstitution();
    expect(constitution.version).toBe(2);
    expect(constitution.amendmentHistory).toHaveLength(1);
  });

  it('should reject amendments to immutable articles', async () => {
    await expect(hive.proposeConstitutionAmendment('safety', 'Remove safety rules')).rejects.toThrow('immutable');
  });

  it('should reject amendments to unknown articles', async () => {
    await expect(hive.proposeConstitutionAmendment('nonexistent', 'change')).rejects.toThrow('not found');
  });

  it('should detect specialization from knowledge contributions', () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    // Simulate knowledge from node-2
    hive.mergeKnowledge([
      { id: 'k1', key: 'coding:pattern:x', value: {}, originInstance: 'node-2', timestamp: new Date(), version: 1, confidence: 0.8 },
      { id: 'k2', key: 'coding:pattern:y', value: {}, originInstance: 'node-2', timestamp: new Date(), version: 1, confidence: 0.8 },
      { id: 'k3', key: 'debugging:tip:z', value: {}, originInstance: 'node-2', timestamp: new Date(), version: 1, confidence: 0.8 },
    ]);
    const spec = hive.detectSpecialization('node-2');
    expect(spec).toBe('coding');
  });

  it('should return null specialization for unknown instance', () => {
    expect(hive.detectSpecialization('nonexistent')).toBeNull();
  });

  it('should return null specialization for instance with no contributions', () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    expect(hive.detectSpecialization('node-2')).toBeNull();
  });

  it('should make collective decisions', async () => {
    const result = await hive.collectiveDecide('Choose framework', ['React', 'Vue', 'Svelte']);
    expect(result.decision).toBeDefined();
    expect(result.vote).toBeDefined();
    expect(result.reasoning).toBeDefined();
  });

  it('should get hive stats', async () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    hive.shareKnowledge('test:key', { data: true });
    await hive.proposeVote('test', 'proposal');
    const stats = hive.getStats();
    expect(stats.instances).toBe(2);
    expect(stats.knowledgeEntries).toBe(1);
    expect(stats.activeVotes).toBe(1);
    expect(stats.constitutionVersion).toBe(1);
  });

  it('should reset all state', () => {
    hive.registerInstance({ id: 'node-2', hostname: 'server2', capabilities: [], specialization: null });
    hive.shareKnowledge('test', {});
    hive.reset();
    expect(hive.getInstances().length).toBe(1); // self re-registered
    expect(hive.getAllKnowledge()).toHaveLength(0);
  });

  it('should enforce max knowledge entries', () => {
    const smallHive = new HiveMind(new MockEchoProvider());
    for (let i = 0; i < 5500; i++) {
      smallHive.shareKnowledge(`key-${i}`, { i });
    }
    expect(smallHive.getAllKnowledge().length).toBeLessThanOrEqual(5000);
  });
});
