import { describe, it, expect } from 'vitest';
import { SwarmOrchestrator } from './orchestrator.js';
import type { SwarmAgent } from './types.js';
import type { AgentRunInput, AgentRun } from '../types.js';

function mockDeps() {
  const runs = new Map<string, AgentRun>();
  return {
    createAgentRun: async (input: AgentRunInput): Promise<AgentRun> => {
      const run: AgentRun = {
        id: `run-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        agentId: input.agentId,
        prompt: input.prompt,
        status: 'completed',
        maxSteps: input.maxSteps ?? 10,
        currentStep: 1,
        tokensUsed: 50,
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      runs.set(run.id, run);
      return run;
    },
    getAgentRun: async (runId: string): Promise<AgentRun | null> => runs.get(runId) ?? null,
  };
}

const TEST_AGENTS: SwarmAgent[] = [
  { id: 'researcher-1', role: 'researcher', name: 'Researcher', description: 'Gathers info', maxSteps: 5, priority: 1 },
  { id: 'coder-1', role: 'coder', name: 'Coder', description: 'Writes code', maxSteps: 5, priority: 2 },
];

describe('SwarmOrchestrator', () => {
  it('creates a swarm task', async () => {
    const orch = new SwarmOrchestrator(mockDeps());
    const task = await orch.createTask({
      description: 'Build a weather app',
      prompt: 'Create a weather forecasting app',
      agents: TEST_AGENTS,
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');
    expect(task.agents).toHaveLength(2);
  });

  it('plans sub-tasks from LLM output', async () => {
    const orch = new SwarmOrchestrator(mockDeps());
    const task = await orch.createTask({
      description: 'Build app',
      prompt: 'Create app',
      agents: TEST_AGENTS,
    });

    const planner = {
      complete: async () => ({
        content: JSON.stringify([
          { role: 'researcher', prompt: 'Research APIs' },
          { role: 'coder', prompt: 'Write code', dependsOn: 0 },
        ]),
      }),
    };

    await orch.plan(task, planner);
    expect(task.subTasks).toHaveLength(2);
    expect(task.subTasks[0]!.agentRole).toBe('researcher');
    expect(task.subTasks[1]!.agentRole).toBe('coder');
  });

  it('executes sub-tasks and marks them complete', async () => {
    const deps = mockDeps();
    const orch = new SwarmOrchestrator(deps);
    const task = await orch.createTask({
      description: 'Build app',
      prompt: 'Create app',
      agents: TEST_AGENTS,
    });

    // Manually add sub-tasks (skip planning)
    task.subTasks = [
      { id: 'st-1', agentRole: 'researcher', prompt: 'Research', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
      { id: 'st-2', agentRole: 'coder', prompt: 'Code', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
    ];

    await orch.execute(task);
    expect(task.subTasks.every((st) => st.status === 'completed')).toBe(true);
    expect(task.status).toBe('synthesizing');
  });

  it('synthesizes final answer from sub-task results', async () => {
    const deps = mockDeps();
    const orch = new SwarmOrchestrator(deps);
    const task = await orch.createTask({
      description: 'Build app',
      prompt: 'Create app',
      agents: TEST_AGENTS,
    });

    task.subTasks = [
      { id: 'st-1', agentRole: 'researcher', prompt: 'Research', status: 'completed', result: 'Found API docs', createdAt: new Date(), updatedAt: new Date() },
    ];
    task.status = 'synthesizing';

    const synthesizer = {
      complete: async () => ({ content: 'Final synthesized answer' }),
    };

    const result = await orch.synthesize(task, synthesizer);
    expect(result.status).toBe('completed');
    expect(result.finalAnswer).toBe('Final synthesized answer');
    expect(result.subTaskResults).toHaveLength(1);
  });

  it('handles planning failure gracefully', async () => {
    const orch = new SwarmOrchestrator(mockDeps());
    const task = await orch.createTask({
      description: 'Build app',
      prompt: 'Create app',
      agents: TEST_AGENTS,
    });

    const planner = {
      complete: async () => {
        throw new Error('LLM error');
      },
    };

    await orch.plan(task, planner);
    expect(task.status).toBe('failed');
    expect(task.subTasks).toHaveLength(0);
  });
});
