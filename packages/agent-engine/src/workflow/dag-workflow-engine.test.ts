import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DAGWorkflowEngine } from './dag-workflow-engine.js';
import { WorkflowBuilder } from './workflow-builder.js';
import type { LlmProvider, AgentRun, ToolResult } from '../types.js';

function mockDeps() {
  const llm: LlmProvider = {
    complete: vi.fn().mockResolvedValue({ content: 'LLM response', tokensUsed: 50, finishReason: 'stop' }),
  };

  const createAgentRun = vi.fn().mockImplementation(async (input: { prompt: string }) => ({
    id: 'run-1',
    agentId: 'generic',
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

  const executeTool = vi.fn().mockResolvedValue({
    success: true,
    data: 'tool result',
  } as ToolResult);

  return { llm, createAgentRun, executeTool };
}

describe('DAGWorkflowEngine', () => {
  let engine: DAGWorkflowEngine;
  let deps: ReturnType<typeof mockDeps>;

  beforeEach(() => {
    deps = mockDeps();
    engine = new DAGWorkflowEngine(deps);
  });

  it('executes a simple linear DAG', async () => {
    const b = new WorkflowBuilder('Linear', 'Linear DAG');
    const input = b.addInput('Start');
    const agent = b.addAgent('Process', { role: 'executor', prompt: 'Do task' });
    const output = b.addOutput('End');
    b.connect(input, agent).connect(agent, output);
    b.setEntry(input);

    const result = await engine.executeDAG(b.build());

    expect(result.status).toBe('completed');
    expect(result.executionOrder).toContain(input);
    expect(result.executionOrder).toContain(agent);
    expect(result.executionOrder).toContain(output);
    expect(result.skippedNodes).toHaveLength(0);
  });

  it('executes parallel branches concurrently', async () => {
    const b = new WorkflowBuilder('Parallel', 'Parallel DAG');
    const input = b.addInput('Start');
    const branchA = b.addAgent('Branch A', { role: 'researcher', prompt: 'Research A' });
    const branchB = b.addAgent('Branch B', { role: 'researcher', prompt: 'Research B' });
    const join = b.addAgent('Join', { role: 'synthesizer', prompt: 'Combine results' });
    const output = b.addOutput('End');

    b.connect(input, branchA).connect(input, branchB);
    b.connect(branchA, join).connect(branchB, join);
    b.connect(join, output);
    b.setEntry(input);

    const result = await engine.executeDAG(b.build());

    expect(result.status).toBe('completed');
    expect(result.parallelBatches.length).toBeGreaterThanOrEqual(3);

    // Branch A and B should be in the same batch
    const branchBatch = result.parallelBatches.find(batch => batch.includes(branchA));
    expect(branchBatch).toBeDefined();
    expect(branchBatch).toContain(branchB);

    // Join should be in a later batch
    const joinBatchIdx = result.parallelBatches.findIndex(batch => batch.includes(join));
    const branchBatchIdx = result.parallelBatches.findIndex(batch => batch.includes(branchA));
    expect(joinBatchIdx).toBeGreaterThan(branchBatchIdx);

    expect(deps.createAgentRun).toHaveBeenCalledTimes(3);
  });

  it('detects cycles and fails gracefully', async () => {
    const b = new WorkflowBuilder('Cyclic', 'Cyclic DAG');
    const a = b.addAgent('A', { role: 'executor', prompt: 'A' });
    const c = b.addAgent('C', { role: 'executor', prompt: 'C' });
    b.connect(a, c).connect(c, a); // cycle
    b.setEntry(a);

    const result = await engine.executeDAG(b.build());

    expect(result.status).toBe('failed');
    expect(result.skippedNodes.length).toBe(2);
  });

  it('retries failed nodes', async () => {
    deps.createAgentRun
      .mockRejectedValueOnce(new Error('Transient failure'))
      .mockResolvedValueOnce({
        id: 'run-1', agentId: 'generic', prompt: '', status: 'completed',
        maxSteps: 5, currentStep: 1, tokensUsed: 100, steps: [],
        finalAnswer: 'Success on retry', createdAt: new Date(), updatedAt: new Date(),
      } as AgentRun);

    const b = new WorkflowBuilder('Retry', 'Retry test');
    const input = b.addInput('Start');
    const agent = b.addAgent('Retry Agent', { role: 'executor', prompt: 'Will fail first' });
    const output = b.addOutput('End');
    b.connect(input, agent).connect(agent, output);
    b.setEntry(input);

    const result = await engine.executeDAG(b.build(), {
      retryPolicy: { maxRetries: 2, retryDelayMs: 10, backoffMultiplier: 1 },
    });

    expect(result.status).toBe('completed');
    expect(result.retriedNodes).toContain(agent);
    expect(deps.createAgentRun).toHaveBeenCalledTimes(2);
  });

  it('skips downstream nodes when failFast is enabled', async () => {
    deps.createAgentRun.mockRejectedValueOnce(new Error('Permanent failure'));

    const b = new WorkflowBuilder('FailFast', 'Fail fast test');
    const input = b.addInput('Start');
    const fail = b.addAgent('Fail', { role: 'executor', prompt: 'Will fail' });
    const after = b.addAgent('After', { role: 'executor', prompt: 'Should be skipped' });
    const output = b.addOutput('End');
    b.connect(input, fail).connect(fail, after).connect(after, output);
    b.setEntry(input);

    const result = await engine.executeDAG(b.build(), {
      failFast: true,
      retryPolicy: { maxRetries: 0, retryDelayMs: 0, backoffMultiplier: 1 },
    });

    expect(result.status).toBe('failed');
    expect(result.skippedNodes).toContain(after);
    expect(result.skippedNodes).toContain(output);
  });

  it('continues execution without failFast on partial failure', async () => {
    deps.createAgentRun
      .mockRejectedValueOnce(new Error('One branch fails'))
      .mockResolvedValueOnce({
        id: 'run-2', agentId: 'generic', prompt: '', status: 'completed',
        maxSteps: 5, currentStep: 1, tokensUsed: 100, steps: [],
        finalAnswer: 'Other branch OK', createdAt: new Date(), updatedAt: new Date(),
      } as AgentRun);

    const b = new WorkflowBuilder('Partial', 'Partial failure');
    const input = b.addInput('Start');
    const branchA = b.addAgent('A', { role: 'executor', prompt: 'Fails' });
    const branchB = b.addAgent('B', { role: 'executor', prompt: 'Succeeds' });
    const output = b.addOutput('End');
    b.connect(input, branchA).connect(input, branchB);
    b.connect(branchA, output).connect(branchB, output);
    b.setEntry(input);

    const result = await engine.executeDAG(b.build(), {
      failFast: false,
      retryPolicy: { maxRetries: 0, retryDelayMs: 0, backoffMultiplier: 1 },
    });

    expect(result.status).toBe('partial');
    expect(result.nodeResults.get(branchA)?.status).toBe('failed');
    expect(result.nodeResults.get(branchB)?.status).toBe('completed');
  });

  it('passes variables to tool nodes', async () => {
    const b = new WorkflowBuilder('Vars', 'Variable test');
    const input = b.addInput('Start');
    const tool = b.addTool('Fetch', { toolName: 'http_request', params: { url: '$targetUrl' } });
    const output = b.addOutput('End');
    b.connect(input, tool).connect(tool, output);
    b.setEntry(input);

    const result = await engine.executeDAG(b.build(), { input: { targetUrl: 'https://example.com' } });

    expect(result.status).toBe('completed');
    expect(deps.executeTool).toHaveBeenCalledOnce();
    const callArgs = deps.executeTool.mock.calls[0];
    expect(callArgs[0].params.url).toBe('https://example.com');
  });

  it('handles condition nodes', async () => {
    const b = new WorkflowBuilder('Conditional', 'Condition test');
    const input = b.addInput('Start');
    const check = b.addCondition('Check', { expression: '$status == pass', trueNext: '', falseNext: '' });
    const yes = b.addAgent('Yes', { role: 'executor', prompt: 'Yes path' });
    const no = b.addAgent('No', { role: 'executor', prompt: 'No path' });
    const output = b.addOutput('End');

    // Wire condition manually
    b.connect(input, check);
    b.connect(check, yes, 'true');
    b.connect(check, no, 'false');
    b.connect(yes, output).connect(no, output);
    b.setEntry(input);

    // Update condition config with actual node IDs
    const checkNode = b.build().nodes.find(n => n.type === 'condition');
    if (checkNode) {
      checkNode.config = { expression: '$status == pass', trueNext: yes, falseNext: no };
    }

    const result = await engine.executeDAG(b.build(), { input: { status: 'pass' } });

    expect(result.status).toBe('completed');
  });

  it('tracks execution stats', async () => {
    const b = new WorkflowBuilder('Stats', 'Stats test');
    const input = b.addInput('Start');
    const agent = b.addAgent('Agent', { role: 'executor', prompt: 'Test' });
    const output = b.addOutput('End');
    b.connect(input, agent).connect(agent, output);
    b.setEntry(input);

    await engine.executeDAG(b.build());
    await engine.executeDAG(b.build());

    const stats = engine.stats();
    expect(stats.totalExecutions).toBe(2);
    expect(stats.completed).toBe(2);
  });

  it('clears execution history', async () => {
    const b = new WorkflowBuilder('Clear', 'Clear test');
    b.addInput('Start');
    b.addOutput('End');
    b.setEntry('node_1');
    b.connect('node_1', 'node_2');

    await engine.executeDAG(b.build());
    engine.clear();
    expect(engine.stats().totalExecutions).toBe(0);
  });
});
