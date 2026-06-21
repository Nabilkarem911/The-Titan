import { describe, it, expect, beforeEach } from 'vitest';
import { A2AProtocolAdapter } from './a2a-protocol.js';
import type { A2AAgentCard } from './a2a-protocol.js';

describe('A2AProtocolAdapter v1.0', () => {
  let a2a: A2AProtocolAdapter;

  beforeEach(() => {
    a2a = new A2AProtocolAdapter();
  });

  const makeCard = (overrides: Partial<A2AAgentCard> = {}): A2AAgentCard => ({
    id: 'agent-1',
    name: 'Test Agent',
    description: 'A test agent',
    url: 'http://localhost:8080',
    capabilities: ['translation', 'summarization'],
    protocolVersion: '1.0',
    ...overrides,
  });

  it('registers self as v1.0 agent with signed card', () => {
    const card = a2a.registerSelf({
      name: 'Titan',
      description: 'Main agent',
      url: 'http://titan:3000',
      capabilities: ['orchestration'],
      signature: 'signed-payload-hash',
      signedBy: 'titan-ca',
      tenantId: 'tenant-1',
      transports: ['http', 'sse'],
      skills: [{ name: 'code-review', description: 'Reviews code', tags: ['code'] }],
    });

    expect(card.protocolVersion).toBe('1.0');
    expect(card.signature).toBe('signed-payload-hash');
    expect(card.signedBy).toBe('titan-ca');
    expect(card.transports).toEqual(['http', 'sse']);
    expect(card.tenantId).toBe('tenant-1');
    expect(card.skills).toHaveLength(1);
  });

  it('verifies signature on registration', () => {
    a2a.registerSelf({
      name: 'Titan',
      description: 'Main',
      url: 'http://t:3000',
      capabilities: ['test'],
      signature: 'valid-sig',
      signedBy: 'ca-1',
    });

    const stats = a2a.stats();
    expect(stats.signedAgents).toBe(1);
  });

  it('registers external agent with v1.0 fields', () => {
    const card = makeCard({
      id: 'ext-1',
      signature: 'ext-sig',
      signedBy: 'ext-ca',
      tenantId: 'tenant-2',
      transports: ['grpc', 'websocket'],
    });
    a2a.registerAgent(card);

    const agent = a2a.getAgent('ext-1');
    expect(agent).not.toBeNull();
    expect(agent!.transports).toEqual(['grpc', 'websocket']);
    expect(agent!.tenantId).toBe('tenant-2');
  });

  it('filters agents by tenant', () => {
    a2a.registerAgent(makeCard({ id: 'a1', tenantId: 't1' }));
    a2a.registerAgent(makeCard({ id: 'a2', tenantId: 't2' }));
    a2a.registerAgent(makeCard({ id: 'a3', tenantId: 't1' }));

    const t1Agents = a2a.getAgentsByTenant('t1');
    expect(t1Agents).toHaveLength(2);
    expect(t1Agents.every(a => a.tenantId === 't1')).toBe(true);
  });

  it('filters agents by capability with tenant scoping', () => {
    a2a.registerAgent(makeCard({ id: 'a1', tenantId: 't1', capabilities: ['translation'] }));
    a2a.registerAgent(makeCard({ id: 'a2', tenantId: 't2', capabilities: ['translation'] }));

    const t1Agents = a2a.findAgentsByCapability('translation', 't1');
    expect(t1Agents).toHaveLength(1);
    expect(t1Agents[0].id).toBe('a1');
  });

  it('finds agents by skill', () => {
    a2a.registerAgent(makeCard({
      id: 'a1',
      skills: [{ name: 'code-review', description: 'Reviews code' }],
    }));
    a2a.registerAgent(makeCard({ id: 'a2' }));

    const skilled = a2a.findAgentsBySkill('code-review');
    expect(skilled).toHaveLength(1);
    expect(skilled[0].id).toBe('a1');
  });

  it('sends and tracks tasks with input_required state', () => {
    a2a.registerAgent(makeCard({ id: 'a1' }));
    const task = a2a.sendTask('a1', { name: 'Translate', content: 'Hello' });

    expect(task.state).toBe('pending');
    expect(task.assignedAgentId).toBe('a1');

    a2a.updateTaskState(task.id, 'input_required');
    const updated = a2a.getTask(task.id);
    expect(updated!.state).toBe('input_required');
  });

  it('cancels tasks', () => {
    a2a.registerAgent(makeCard({ id: 'a1' }));
    const task = a2a.sendTask('a1', { name: 'Task', content: 'Do something' });
    a2a.cancelTask(task.id);
    expect(a2a.getTask(task.id)!.state).toBe('canceled');
  });

  it('tracks v1.0 stats including signed agents, tenants, transports', () => {
    a2a.registerSelf({
      name: 'Titan',
      description: 'Main',
      url: 'http://t:3000',
      capabilities: ['orchestration'],
      signature: 'sig',
      signedBy: 'ca',
      tenantId: 't1',
      transports: ['http', 'sse'],
    });
    a2a.registerAgent(makeCard({
      id: 'ext1',
      tenantId: 't2',
      transports: ['grpc'],
      signature: 'sig2',
      signedBy: 'ca2',
    }));

    const stats = a2a.stats();
    expect(stats.signedAgents).toBe(2);
    expect(stats.tenants).toBe(2);
    expect(stats.byTransport.length).toBeGreaterThan(0);
    const httpCount = stats.byTransport.find(t => t.transport === 'http');
    expect(httpCount?.count).toBe(1);
    const grpcCount = stats.byTransport.find(t => t.transport === 'grpc');
    expect(grpcCount?.count).toBe(1);
  });

  it('pings agents and marks health', () => {
    a2a.registerAgent(makeCard({ id: 'a1' }));
    expect(a2a.ping('a1')).toBe(true);
    a2a.markUnhealthy('a1');
    const agents = a2a.findAgentsByCapability('translation');
    expect(agents.find(a => a.id === 'a1')).toBeUndefined();
  });

  it('emits events on registration and task operations', () => {
    let registered = false;
    let taskSent = false;
    a2a.on('agent:registered', () => { registered = true; });
    a2a.on('task:sent', () => { taskSent = true; });

    a2a.registerAgent(makeCard({ id: 'a1' }));
    a2a.sendTask('a1', { name: 'Task', content: 'Test' });

    expect(registered).toBe(true);
    expect(taskSent).toBe(true);
  });
});
