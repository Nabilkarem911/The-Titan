import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmEvolution } from './swarm-evolution.js';

describe('SwarmEvolution', () => {
  let se: SwarmEvolution;

  beforeEach(() => {
    se = new SwarmEvolution();
  });

  it('should auto-decide agent count based on complexity', () => {
    expect(se.autoDecideAgentCount(20)).toBe(2);
    expect(se.autoDecideAgentCount(100)).toBe(10);
    expect(se.autoDecideAgentCount(5)).toBe(1);
  });

  it('should cap agent count at 20', () => {
    expect(se.autoDecideAgentCount(500)).toBe(20);
  });

  it('should detect emergent specialization', () => {
    const role = se.detectEmergentSpecialization('agent-1', [
      { task: 'debug the parser', success: true, score: 90 },
      { task: 'fix the bug', success: true, score: 85 },
      { task: 'write tests', success: false, score: 40 },
    ]);
    expect(role.agentId).toBe('agent-1');
    expect(role.specialization).toBe('debugging');
  });

  it('should create topology', () => {
    const topo = se.createTopology('orchestrator-worker', 5);
    expect(topo.pattern).toBe('orchestrator-worker');
    expect(topo.agentCount).toBe(5);
    expect(se.getCurrentTopology()).not.toBeNull();
  });

  it('should reconfigure topology', () => {
    se.createTopology('pipeline', 3);
    const reconfigured = se.reconfigureTopology('orchestrator-worker');
    expect(reconfigured).not.toBeNull();
    expect(reconfigured!.pattern).toBe('orchestrator-worker');
  });

  it('should return null reconfigure when no current topology', () => {
    expect(se.reconfigureTopology('pipeline')).toBeNull();
  });

  it('should select best pattern for task type', () => {
    expect(se.selectBestPattern('parallel')).toBe('orchestrator-worker');
    expect(se.selectBestPattern('sequential')).toBe('pipeline');
    expect(se.selectBestPattern('collaborative')).toBe('peer-to-peer');
  });

  it('should write and read collective memory', () => {
    se.writeCollectiveMemory('key1', 'value1', 'agent-A');
    const entry = se.readCollectiveMemory('key1');
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe('value1');
    expect(entry!.version).toBe(1);
  });

  it('should increment version on collective memory writes', () => {
    se.writeCollectiveMemory('key1', 'value1', 'agent-A');
    se.writeCollectiveMemory('key1', 'value2', 'agent-B');
    const entry = se.readCollectiveMemory('key1');
    expect(entry!.version).toBe(2);
    expect(entry!.value).toBe('value2');
  });

  it('should track conflicts in collective memory', () => {
    se.writeCollectiveMemory('key1', 'value1', 'agent-A');
    se.writeCollectiveMemory('key1', 'value2', 'agent-B');
    const entry = se.readCollectiveMemory('key1');
    expect(entry!.conflicts).toHaveLength(1);
  });

  it('should resolve conflicts', () => {
    se.writeCollectiveMemory('key1', 'value1', 'agent-A');
    se.writeCollectiveMemory('key1', 'value2', 'agent-B');
    const resolved = se.resolveConflict('key1');
    expect(resolved!.conflicts).toHaveLength(0);
  });

  it('should delegate tasks', () => {
    const task = se.delegateTask('agent-A', 'agent-B', { work: 'test' });
    expect(task.type).toBe('delegation');
    expect(task.status).toBe('pending');
  });

  it('should exchange skills', () => {
    const task = se.exchangeSkill('agent-A', 'agent-B', { skill: 'debugging' });
    expect(task.type).toBe('skill_exchange');
  });

  it('should federated learn', () => {
    const task = se.federatedLearn('agent-A', 'agent-B', { diff: 'model-update' });
    expect(task.type).toBe('federated_learning');
  });

  it('should complete federation tasks', () => {
    const task = se.delegateTask('agent-A', 'agent-B', {});
    se.completeFederationTask(task.id, 'completed');
    expect(se.getFederationTasks()[0].status).toBe('completed');
  });

  it('should get stats', () => {
    se.createTopology('pipeline', 3);
    se.writeCollectiveMemory('k', 'v', 'a');
    se.delegateTask('a', 'b', {});
    const stats = se.getStats();
    expect(stats.topologiesCreated).toBe(1);
    expect(stats.memoryEntries).toBe(1);
    expect(stats.federationTasks).toBe(1);
  });

  it('should reset', () => {
    se.createTopology('pipeline', 3);
    se.writeCollectiveMemory('k', 'v', 'a');
    se.reset();
    expect(se.getTopologies()).toHaveLength(0);
    expect(se.getCollectiveMemorySize()).toBe(0);
  });
});
