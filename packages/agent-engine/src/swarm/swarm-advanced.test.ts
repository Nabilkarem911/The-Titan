import { describe, it, expect, vi } from 'vitest';
import { MessageBus } from './message-bus.js';
import { SharedWorkspace } from './shared-workspace.js';
import { Supervisor } from './supervisor.js';
import { Negotiator } from './negotiator.js';
import type { LlmProvider } from '../types.js';
import type { SwarmTask, SwarmSubTask } from './types.js';

function mockLlm(content: string): LlmProvider {
  return { complete: vi.fn().mockResolvedValue({ content, tokensUsed: 50, finishReason: 'stop' }) };
}

function makeTask(subTasks: Partial<SwarmSubTask>[]): SwarmTask {
  return {
    id: 'task-1',
    description: 'Test task',
    originalPrompt: 'Do something',
    status: 'executing',
    agents: [
      { id: 'a1', role: 'researcher', name: 'Researcher', description: 'Research', maxSteps: 5, priority: 1 },
      { id: 'a2', role: 'coder', name: 'Coder', description: 'Code', maxSteps: 5, priority: 1 },
      { id: 'a3', role: 'reviewer', name: 'Reviewer', description: 'Review', maxSteps: 5, priority: 1 },
    ],
    subTasks: subTasks.map((s, i) => ({
      id: s.id ?? `st-${i}`,
      agentRole: s.agentRole ?? 'researcher',
      prompt: s.prompt ?? `Task ${i}`,
      status: s.status ?? 'pending',
      result: s.result,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...s,
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ── MessageBus ──

describe('MessageBus', () => {
  it('delivers messages to subscribers', async () => {
    const bus = new MessageBus();
    const received: string[] = [];

    bus.subscribe('agent-b', (msg) => { received.push(msg.content); });
    await bus.send({ from: 'agent-a', to: 'agent-b', type: 'data', content: 'Hello' });

    expect(received).toEqual(['Hello']);
  });

  it('broadcasts to all except sender', async () => {
    const bus = new MessageBus();
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    bus.subscribe('agent-a', (msg) => { receivedA.push(msg.content); });
    bus.subscribe('agent-b', (msg) => { receivedB.push(msg.content); });

    await bus.send({ from: 'agent-a', to: 'broadcast', type: 'status', content: 'Update' });

    expect(receivedA).toEqual([]);
    expect(receivedB).toEqual(['Update']);
  });

  it('tracks message history', async () => {
    const bus = new MessageBus();
    await bus.send({ from: 'a', to: 'b', type: 'data', content: 'msg1' });
    await bus.send({ from: 'b', to: 'a', type: 'response', content: 'msg2' });

    const history = bus.getHistory();
    expect(history.length).toBe(2);
  });

  it('gets conversation between two agents', async () => {
    const bus = new MessageBus();
    await bus.send({ from: 'a', to: 'b', type: 'data', content: 'Hi' });
    await bus.send({ from: 'b', to: 'a', type: 'response', content: 'Hey' });
    await bus.send({ from: 'a', to: 'c', type: 'data', content: 'Other' });

    const convo = bus.getConversation('a', 'b');
    expect(convo.length).toBe(2);
  });

  it('unsubscribes correctly', async () => {
    const bus = new MessageBus();
    const received: string[] = [];

    const unsub = bus.subscribe('agent-b', (msg) => { received.push(msg.content); });
    await bus.send({ from: 'a', to: 'agent-b', type: 'data', content: 'before' });
    unsub();
    await bus.send({ from: 'a', to: 'agent-b', type: 'data', content: 'after' });

    expect(received).toEqual(['before']);
  });
});

// ── SharedWorkspace ──

describe('SharedWorkspace', () => {
  it('stores and retrieves artifacts', () => {
    const ws = new SharedWorkspace();
    ws.put('search_results', ['result1', 'result2'], 'researcher');
    expect(ws.get('search_results')).toEqual(['result1', 'result2']);
  });

  it('tracks producers and consumers', () => {
    const ws = new SharedWorkspace();
    ws.put('data', 'value', 'agent-a');
    ws.get('data', 'agent-b');
    ws.get('data', 'agent-c');

    const artifact = ws.getArtifact('data');
    expect(artifact?.producedBy).toBe('agent-a');
    expect(artifact?.consumedBy).toEqual(['agent-b', 'agent-c']);
  });

  it('manages agent notes', () => {
    const ws = new SharedWorkspace();
    ws.setNote('researcher', 'Found 3 relevant papers');
    ws.setNote('coder', 'Implementation needs refactoring');

    expect(ws.getNote('researcher')).toBe('Found 3 relevant papers');
    expect(ws.getAllNotes().size).toBe(2);
  });

  it('builds summary', () => {
    const ws = new SharedWorkspace();
    ws.put('result', 'Some data', 'agent-a');
    ws.setNote('agent-a', 'Done');
    const summary = ws.buildSummary();
    expect(summary).toContain('result');
    expect(summary).toContain('agent-a');
  });

  it('lists artifacts by producer', () => {
    const ws = new SharedWorkspace();
    ws.put('a', 1, 'agent-1');
    ws.put('b', 2, 'agent-1');
    ws.put('c', 3, 'agent-2');

    const artifacts = ws.getArtifactsByProducer('agent-1');
    expect(artifacts.length).toBe(2);
  });
});

// ── Supervisor ──

describe('Supervisor', () => {
  it('returns continue when no failures', async () => {
    const bus = new MessageBus();
    const ws = new SharedWorkspace();
    const supervisor = new Supervisor({ llm: mockLlm(''), messageBus: bus, workspace: ws });

    const task = makeTask([
      { status: 'completed', result: 'Done' },
      { status: 'running' },
    ]);

    const decision = await supervisor.evaluate(task);
    expect(decision.action).toBe('continue');
  });

  it('aborts when majority failed', async () => {
    const bus = new MessageBus();
    const ws = new SharedWorkspace();
    const supervisor = new Supervisor({ llm: mockLlm(''), messageBus: bus, workspace: ws });

    const task = makeTask([
      { status: 'failed' },
      { status: 'failed' },
      { status: 'completed', result: 'Done' },
    ]);

    const decision = await supervisor.evaluate(task);
    expect(decision.action).toBe('abort');
  });

  it('applies reassign decision', () => {
    const bus = new MessageBus();
    const ws = new SharedWorkspace();
    const supervisor = new Supervisor({ llm: mockLlm(''), messageBus: bus, workspace: ws });

    const task = makeTask([{ id: 'st-0', agentRole: 'researcher', status: 'failed' }]);
    const decision = { action: 'reassign' as const, reason: 'test', targetSubTaskId: 'st-0', newAgent: 'coder' as const };

    supervisor.applyDecision(task, decision);
    expect(task.subTasks[0].agentRole).toBe('coder');
    expect(task.subTasks[0].status).toBe('pending');
  });

  it('applies add_task decision', () => {
    const bus = new MessageBus();
    const ws = new SharedWorkspace();
    const supervisor = new Supervisor({ llm: mockLlm(''), messageBus: bus, workspace: ws });

    const task = makeTask([{ status: 'completed', result: 'Done' }]);
    const decision = {
      action: 'add_task' as const,
      reason: 'Missing verification step',
      newTask: { prompt: 'Verify results', role: 'reviewer' as const, dependsOn: [] },
    };

    supervisor.applyDecision(task, decision);
    expect(task.subTasks.length).toBe(2);
    expect(task.subTasks[1].agentRole).toBe('reviewer');
  });

  it('broadcasts progress', async () => {
    const bus = new MessageBus();
    const ws = new SharedWorkspace();
    const supervisor = new Supervisor({ llm: mockLlm(''), messageBus: bus, workspace: ws });

    const received: string[] = [];
    bus.subscribe('agent-1', (msg) => { received.push(msg.content); });

    const task = makeTask([{ status: 'completed', result: 'Done' }, { status: 'running', agentRole: 'coder' }]);
    await supervisor.broadcastProgress(task);

    expect(received.length).toBe(1);
    expect(received[0]).toContain('1/2');
  });
});

// ── Negotiator ──

describe('Negotiator', () => {
  it('detects conflicts between reviewer and coder', () => {
    const negotiator = new Negotiator(mockLlm(''));
    const subTasks: SwarmSubTask[] = [
      { id: 'st-1', agentRole: 'coder', prompt: 'Write code', status: 'completed', result: 'Implemented solution', createdAt: new Date(), updatedAt: new Date() },
      { id: 'st-2', agentRole: 'reviewer', prompt: 'Review code', status: 'completed', result: 'Code has issues', createdAt: new Date(), updatedAt: new Date() },
    ];

    const conflicts = negotiator.detectConflicts(subTasks);
    expect(conflicts.length).toBe(1);
  });

  it('resolves conflict with LLM', async () => {
    const llm = mockLlm(JSON.stringify({ winner: 'merge', mergedResult: 'Combined approach', reason: 'Both have valid points' }));
    const negotiator = new Negotiator(llm);

    const conflict = {
      subTaskA: { id: 'st-1', agentRole: 'coder' as const, prompt: 'Write', status: 'completed' as const, result: 'Solution A', createdAt: new Date(), updatedAt: new Date() },
      subTaskB: { id: 'st-2', agentRole: 'reviewer' as const, prompt: 'Review', status: 'completed' as const, result: 'Solution B', createdAt: new Date(), updatedAt: new Date() },
      description: 'Conflict',
    };

    const resolution = await negotiator.resolve(conflict);
    expect(resolution.winner).toBe('merge');
    expect(resolution.mergedResult).toBe('Combined approach');
  });

  it('detects contradiction keywords', () => {
    const negotiator = new Negotiator(mockLlm(''));
    const subTasks: SwarmSubTask[] = [
      { id: 'st-1', agentRole: 'researcher', prompt: 'Research', status: 'completed', result: 'We should use Redis', createdAt: new Date(), updatedAt: new Date() },
      { id: 'st-2', agentRole: 'executor', prompt: 'Execute', status: 'completed', result: 'We should not use Redis', createdAt: new Date(), updatedAt: new Date() },
    ];

    const conflicts = negotiator.detectConflicts(subTasks);
    expect(conflicts.length).toBe(1);
  });
});
