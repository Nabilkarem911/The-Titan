import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from './runner.js';
import { MockLlmProvider, MockEchoProvider } from './mockLlmProvider.js';
import type { ToolCall, ToolResult } from './types.js';

describe('AgentRunner', () => {
  it('completes a simple echo run (no tools)', async () => {
    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'should not be called' }),
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Say hello',
      maxSteps: 5,
    });

    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(1);
    expect(result.finalAnswer).toContain('Say hello');
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  it('completes a ReAct loop with tool call', async () => {
    const toolSpy = vi.fn(async (_call: ToolCall, _runId: string): Promise<ToolResult> => {
      return { success: true, data: { stdout: 'hello world\n' } };
    });

    const runner = new AgentRunner({
      llm: new MockLlmProvider(),
      executeTool: toolSpy,
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Run a command',
      maxSteps: 5,
    });

    expect(result.status).toBe('completed');
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(toolSpy).toHaveBeenCalledTimes(1);
    expect(toolSpy.mock.calls[0][0].name).toBe('execute_bash');
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  it('blocks forbidden tools', async () => {
    const toolSpy = vi.fn(async (): Promise<ToolResult> => ({ success: true, data: {} }));

    const runner = new AgentRunner({
      llm: new MockLlmProvider(),
      executeTool: toolSpy,
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Run a command',
      maxSteps: 5,
      forbiddenTools: ['execute_bash'],
    });

    expect(result.status).toBe('completed');
    expect(result.steps[0].status).toBe('failed');
    expect(result.steps[0].observation?.error).toContain('forbidden');
    expect(toolSpy).not.toHaveBeenCalled();
  });

  it('respects max steps', async () => {
    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'should not be called' }),
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello',
      maxSteps: 1,
    });

    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(1);
    expect(result.currentStep).toBe(1);
  });

  it('respects token budget', async () => {
    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'should not be called' }),
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello',
      maxSteps: 10,
      tokenBudget: 1, // very low, first step will exhaust it
    });

    expect(result.status).toBe('completed');
    expect(result.finalAnswer).toContain('Token budget exhausted');
  });

  it('calls persistRun after each step', async () => {
    const persistSpy = vi.fn(async () => {});

    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'should not be called' }),
      persistRun: persistSpy,
    });

    await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello',
      maxSteps: 2,
    });

    // once after step, once after run finish
    expect(persistSpy).toHaveBeenCalledTimes(2);
  });

  it('calls onStep callback', async () => {
    const stepSpy = vi.fn(async () => {});

    const runner = new AgentRunner({
      llm: new MockLlmProvider(),
      executeTool: async () => ({ success: true, data: {} }),
      onStep: stepSpy,
    });

    await runner.run({
      agentId: 'test-agent',
      prompt: 'Run something',
      maxSteps: 5,
    });

    expect(stepSpy).toHaveBeenCalledTimes(2);
    const firstCall = stepSpy.mock.calls[0] as unknown[] | undefined;
    if (firstCall && firstCall[0]) {
      expect((firstCall[0] as { action?: { name?: string } }).action?.name).toBe('execute_bash');
    }
  });

  it('retrieves and stores memory when memory client is provided', async () => {
    const searchSpy = vi.fn(async () => [{ id: 'm1', content: 'Previous context', score: 0.9 }]);
    const upsertSpy = vi.fn(async () => {});

    const mockMemory = {
      search: searchSpy,
      upsert: upsertSpy,
    } as unknown as import('@titan/memory').MemoryClient;

    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'should not be called' }),
      memory: mockMemory,
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'What is the weather?',
      workspaceId: 'ws-1',
      maxSteps: 3,
    });

    expect(result.status).toBe('completed');
    expect(searchSpy).toHaveBeenCalledWith('workspace_ws-1', 'What is the weather?', { limit: 5 });
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const upsertCall = upsertSpy.mock.calls[0] as unknown[] | undefined;
    if (upsertCall && upsertCall[1]) {
      const items = upsertCall[1] as Array<{ content: string }>;
      expect(items[0]!.content).toContain('What is the weather?');
    }
  });
});
