import { describe, it, expect, vi } from 'vitest';
import { WorkflowBuilder } from './workflow-builder.js';
import { WorkflowRunner } from './workflow-runner.js';
import type { LlmProvider, AgentRun } from '../types.js';

function mockDeps() {
  const llm: LlmProvider = {
    complete: vi.fn().mockResolvedValue({ content: 'LLM response', tokensUsed: 50, finishReason: 'stop' }),
  };

  const createAgentRun = vi.fn().mockImplementation(async (input: { prompt: string }) => ({
    id: 'run-1',
    agentId: input.prompt.includes('Search') ? 'researcher' : 'generic',
    prompt: input.prompt,
    status: 'completed',
    maxSteps: 5,
    currentStep: 1,
    tokensUsed: 100,
    steps: [],
    finalAnswer: `Result for: ${input.prompt.slice(0, 50)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as AgentRun));

  const executeTool = vi.fn().mockResolvedValue({ success: true, data: 'tool result' });

  return { llm, createAgentRun, executeTool };
}

// ── WorkflowBuilder ──

describe('WorkflowBuilder', () => {
  it('builds a simple sequential workflow', () => {
    const b = new WorkflowBuilder('Test', 'Test workflow');
    const input = b.addInput('Start');
    const agent = b.addAgent('Process', { role: 'executor', prompt: 'Do something' });
    const output = b.addOutput('End');
    b.connect(input, agent).connect(agent, output);
    b.setEntry(input);

    const workflow = b.build();
    expect(workflow.nodes.length).toBe(3);
    expect(workflow.edges.length).toBe(2);
    expect(workflow.entryNode).toBe(input);
  });

  it('builds research template', () => {
    const workflow = WorkflowBuilder.research('TypeScript best practices');
    expect(workflow.name).toBe('Research Workflow');
    expect(workflow.nodes.length).toBe(5);
    expect(workflow.edges.length).toBe(4);
  });

  it('builds code review template', () => {
    const workflow = WorkflowBuilder.codeReview('Review auth module');
    expect(workflow.name).toBe('Code Review Workflow');
    expect(workflow.nodes.length).toBe(5);
  });

  it('builds data pipeline template', () => {
    const workflow = WorkflowBuilder.dataPipeline('Analyze logs');
    expect(workflow.name).toBe('Data Pipeline');
    expect(workflow.nodes.length).toBe(5);
  });

  it('adds condition with true/false edges', () => {
    const b = new WorkflowBuilder('Conditional', '');
    const input = b.addInput('Start');
    const yes = b.addAgent('Yes path', { role: 'executor', prompt: 'Yes' });
    const no = b.addAgent('No path', { role: 'executor', prompt: 'No' });
    b.addCondition('Check', { expression: '$result == pass', trueNext: yes, falseNext: no });

    const workflow = b.build();
    const condEdges = workflow.edges.filter((e) => e.label === 'true' || e.label === 'false');
    expect(condEdges.length).toBe(2);
  });

  it('auto-sets entry node to first node', () => {
    const b = new WorkflowBuilder('Auto', '');
    b.addInput('First');
    b.addAgent('Second', { role: 'executor', prompt: 'test' });

    const workflow = b.build();
    expect(workflow.entryNode).toBe('node_1');
  });
});

// ── WorkflowRunner ──

describe('WorkflowRunner', () => {
  it('runs a simple sequential workflow', async () => {
    const deps = mockDeps();
    const runner = new WorkflowRunner(deps);

    const b = new WorkflowBuilder('Test', '');
    const input = b.addInput('Start');
    const agent = b.addAgent('Process', { role: 'executor', prompt: 'Do task' });
    const output = b.addOutput('End');
    b.connect(input, agent).connect(agent, output);
    b.setEntry(input);

    const state = await runner.run(b.build());

    expect(state.status).toBe('completed');
    expect(state.nodeResults.size).toBe(3);
    expect(deps.createAgentRun).toHaveBeenCalledOnce();
  });

  it('runs research workflow template', async () => {
    const deps = mockDeps();
    const runner = new WorkflowRunner(deps);

    const workflow = WorkflowBuilder.research('AI agents');
    const state = await runner.run(workflow);

    expect(state.status).toBe('completed');
    expect(deps.createAgentRun).toHaveBeenCalledTimes(3); // search, analyze, summarize
  });

  it('passes context between nodes', async () => {
    const deps = mockDeps();
    const runner = new WorkflowRunner(deps);

    const b = new WorkflowBuilder('Chain', '');
    const input = b.addInput('Start');
    const step1 = b.addAgent('Step1', { role: 'researcher', prompt: 'Research X' });
    const step2 = b.addAgent('Step2', { role: 'synthesizer', prompt: 'Summarize findings' });
    const output = b.addOutput('End');
    b.connect(input, step1).connect(step1, step2).connect(step2, output);
    b.setEntry(input);

    const state = await runner.run(b.build());
    expect(state.status).toBe('completed');

    // Second agent should receive context from first
    const secondCall = deps.createAgentRun.mock.calls[1];
    expect(secondCall[0].prompt).toContain('Context from previous step');
  });

  it('runs tool nodes', async () => {
    const deps = mockDeps();
    const runner = new WorkflowRunner(deps);

    const b = new WorkflowBuilder('Tool test', '');
    const input = b.addInput('Start');
    const tool = b.addTool('Search', { toolName: 'brave_search', params: { q: 'test' } });
    const output = b.addOutput('End');
    b.connect(input, tool).connect(tool, output);
    b.setEntry(input);

    const state = await runner.run(b.build());
    expect(state.status).toBe('completed');
    expect(deps.executeTool).toHaveBeenCalledOnce();
  });

  it('accepts initial variables', async () => {
    const deps = mockDeps();
    const runner = new WorkflowRunner(deps);

    const b = new WorkflowBuilder('Vars', '');
    const input = b.addInput('Start');
    const tool = b.addTool('Fetch', { toolName: 'http_request', params: { url: '$targetUrl' } });
    const output = b.addOutput('End');
    b.connect(input, tool).connect(tool, output);
    b.setEntry(input);

    const state = await runner.run(b.build(), { targetUrl: 'https://example.com' });
    expect(state.status).toBe('completed');
  });

  it('handles node execution failure gracefully', async () => {
    const deps = mockDeps();
    deps.createAgentRun.mockRejectedValueOnce(new Error('Agent failed'));
    const runner = new WorkflowRunner(deps);

    const b = new WorkflowBuilder('Fail', '');
    const input = b.addInput('Start');
    const agent = b.addAgent('Fail', { role: 'executor', prompt: 'Will fail' });
    const output = b.addOutput('End');
    b.connect(input, agent).connect(agent, output);
    b.setEntry(input);

    const state = await runner.run(b.build());
    expect(state.status).toBe('failed');
  });
});
