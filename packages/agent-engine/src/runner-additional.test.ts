import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from './runner.js';
import { MockLlmProvider, MockEchoProvider } from './mockLlmProvider.js';
import type { LlmProvider, LlmMessage, LlmCompletion, ToolCall, ToolResult, LlmToolDefinition } from './types.js';

/**
 * A mock provider that always requests the same tool call, used to test
 * the repeated-tool-call loop breaker.
 */
class RepeatingToolProvider implements LlmProvider {
  async complete(): Promise<LlmCompletion> {
    // Always request the exact same tool call — never return a direct answer
    return {
      content: '',
      toolCalls: [{ name: 'execute_bash', params: { command: 'echo hello' } }],
      tokensUsed: 15,
      finishReason: 'tool_calls',
    };
  }
}

/**
 * A mock provider that throws an error on the first call.
 */
class ErrorProvider implements LlmProvider {
  async complete(): Promise<LlmCompletion> {
    throw new Error('LLM service unavailable');
  }
}

/**
 * A mock provider whose step count is controllable: requests tools on the
 * first N calls, then gives a plain reflection (no FINAL ANSWER) so the
 * runner keeps looping until maxSteps is exhausted.
 */
class NeverFinishProvider implements LlmProvider {
  private callCount = 0;

  async complete(): Promise<LlmCompletion> {
    this.callCount++;
    // Always request a tool call with different params to avoid the loop breaker
    return {
      content: '',
      toolCalls: [{ name: 'execute_bash', params: { command: `echo step ${this.callCount}` } }],
      tokensUsed: 10,
      finishReason: 'tool_calls',
    };
  }
}

/**
 * A mock provider that tracks how many tool definitions it receives.
 */
class ToolCapturingProvider implements LlmProvider {
  capturedTools: LlmToolDefinition[] | undefined;
  private callCount = 0;

  async complete(
    messages: LlmMessage[],
    opts?: { tools?: LlmToolDefinition[] },
  ): Promise<LlmCompletion> {
    this.callCount++;
    if (this.callCount === 1) {
      this.capturedTools = opts?.tools;
    }
    const lastUser = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    return {
      content: `FINAL ANSWER: Done with ${lastUser}`,
      tokensUsed: 20,
      finishReason: 'stop',
    };
  }
}

describe('AgentRunner — additional scenarios', () => {
  it('sets status to "failed" when LLM throws an error', async () => {
    const runner = new AgentRunner({
      llm: new ErrorProvider(),
      executeTool: async () => ({ success: true, data: {} }),
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Do something',
      maxSteps: 5,
    });

    expect(result.status).toBe('failed');
    expect(result.finalAnswer).toBe('LLM service unavailable');
  });

  it('breaks out of repeated identical tool calls', async () => {
    const toolSpy = vi.fn(async (): Promise<ToolResult> => ({
      success: true,
      data: 'same result',
    }));

    const runner = new AgentRunner({
      llm: new RepeatingToolProvider(),
      executeTool: toolSpy,
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Keep trying',
      maxSteps: 20,
    });

    expect(result.status).toBe('completed');
    // The loop breaker kicks in at 3 identical calls
    expect(toolSpy).toHaveBeenCalledTimes(3);
    // The finalAnswer should mention the tool name since it was a loop break
    expect(result.finalAnswer).toBeDefined();
  });

  it('reaches max steps without explicit completion', async () => {
    const toolSpy = vi.fn(async (): Promise<ToolResult> => ({
      success: true,
      data: { stdout: 'ok' },
    }));

    const runner = new AgentRunner({
      llm: new NeverFinishProvider(),
      executeTool: toolSpy,
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Do many things',
      maxSteps: 3,
    });

    expect(result.status).toBe('completed');
    expect(result.finalAnswer).toBe('Max steps reached without explicit completion.');
    expect(result.steps).toHaveLength(3);
    expect(result.currentStep).toBe(3);
  });

  it('gracefully handles memory retrieval failure', async () => {
    const searchSpy = vi.fn(async () => {
      throw new Error('Redis connection refused');
    });
    const upsertSpy = vi.fn(async () => {});

    const mockMemory = {
      search: searchSpy,
      upsert: upsertSpy,
    } as unknown as import('@titan/memory').MemoryClient;

    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'unused' }),
      memory: mockMemory,
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello with broken memory',
      maxSteps: 3,
    });

    // Should complete successfully despite memory failure
    expect(result.status).toBe('completed');
    expect(result.finalAnswer).toBeDefined();
    expect(searchSpy).toHaveBeenCalledTimes(1);
    // Memory storage should still be attempted
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it('gracefully handles memory storage failure', async () => {
    const searchSpy = vi.fn(async () => []);
    const upsertSpy = vi.fn(async () => {
      throw new Error('Write failed');
    });

    const mockMemory = {
      search: searchSpy,
      upsert: upsertSpy,
    } as unknown as import('@titan/memory').MemoryClient;

    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'unused' }),
      memory: mockMemory,
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello',
      maxSteps: 3,
    });

    // Should complete successfully despite memory storage failure
    expect(result.status).toBe('completed');
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it('handles tool execution that returns an error result', async () => {
    const toolSpy = vi.fn(async (): Promise<ToolResult> => ({
      success: false,
      error: 'Permission denied: cannot execute bash',
    }));

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
    expect(toolSpy).toHaveBeenCalledTimes(1);
    // The tool was called but returned an error — the agent should still complete
    const toolStep = result.steps.find((s) => s.action?.name === 'execute_bash');
    expect(toolStep).toBeDefined();
    expect(toolStep!.observation?.success).toBe(false);
    expect(toolStep!.observation?.error).toContain('Permission denied');
  });

  it('injects userContextItems into the system prompt', async () => {
    /** A provider that captures the system message for inspection */
    let capturedSystemPrompt = '';
    const capturingProvider: LlmProvider = {
      async complete(messages: LlmMessage[]): Promise<LlmCompletion> {
        const sys = messages.find((m) => m.role === 'system');
        if (sys) capturedSystemPrompt = sys.content;
        return {
          content: 'Done',
          tokensUsed: 10,
          finishReason: 'stop',
        };
      },
    };

    const runner = new AgentRunner({
      llm: capturingProvider,
      executeTool: async () => ({ success: false, error: 'unused' }),
      userContextItems: {
        'preference:language': 'arabic-egyptian',
        'tone:formal': 'false',
      },
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello',
      maxSteps: 3,
    });

    expect(result.status).toBe('completed');
    expect(capturedSystemPrompt).toContain('preference:language: arabic-egyptian');
    expect(capturedSystemPrompt).toContain('tone:formal: false');
  });

  it('appends systemPromptExtra to the base system prompt', async () => {
    let capturedSystemPrompt = '';
    const capturingProvider: LlmProvider = {
      async complete(messages: LlmMessage[]): Promise<LlmCompletion> {
        const sys = messages.find((m) => m.role === 'system');
        if (sys) capturedSystemPrompt = sys.content;
        return {
          content: 'Done',
          tokensUsed: 10,
          finishReason: 'stop',
        };
      },
    };

    const runner = new AgentRunner({
      llm: capturingProvider,
      executeTool: async () => ({ success: false, error: 'unused' }),
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello',
      maxSteps: 3,
      systemPromptExtra: '\n\nCustom project context: this is a Node.js project.',
    });

    expect(result.status).toBe('completed');
    expect(capturedSystemPrompt).toContain('Custom project context: this is a Node.js project.');
  });

  it('uses custom tools from deps.tools instead of global registry', async () => {
    const customTools: LlmToolDefinition[] = [
      {
        name: 'custom_tool',
        description: 'A custom tool for testing',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Tool input' },
          },
          required: ['input'],
        },
      },
    ];

    const toolCapture = new ToolCapturingProvider();

    const runner = new AgentRunner({
      llm: toolCapture,
      executeTool: async () => ({ success: true, data: {} }),
      tools: customTools,
    });

    await runner.run({
      agentId: 'test-agent',
      prompt: 'Use custom tool',
      maxSteps: 3,
    });

    expect(toolCapture.capturedTools).toBeDefined();
    expect(toolCapture.capturedTools).toHaveLength(1);
    expect(toolCapture.capturedTools![0].name).toBe('custom_tool');
  });

  it('exhausts token budget after a tool execution step', async () => {
    /** Provider that uses many tokens on tool call + reflection */
    let callCount = 0;
    const heavyTokenProvider: LlmProvider = {
      async complete(): Promise<LlmCompletion> {
        callCount++;
        if (callCount === 1) {
          return {
            content: '',
            toolCalls: [{ name: 'execute_bash', params: { command: 'echo hi' } }],
            tokensUsed: 500,
            finishReason: 'tool_calls',
          };
        }
        // Reflection
        return {
          content: 'Thinking about it...',
          tokensUsed: 600,
          finishReason: 'stop',
        };
      },
    };

    const runner = new AgentRunner({
      llm: heavyTokenProvider,
      executeTool: async () => ({ success: true, data: 'ok' }),
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Do something expensive',
      maxSteps: 10,
      tokenBudget: 1000,
    });

    expect(result.status).toBe('completed');
    expect(result.finalAnswer).toContain('Token budget exhausted');
    expect(result.tokensUsed).toBeGreaterThanOrEqual(1000);
  });

  it('persists the run on failure', async () => {
    const persistSpy = vi.fn(async () => {});

    const runner = new AgentRunner({
      llm: new ErrorProvider(),
      executeTool: async () => ({ success: true, data: {} }),
      persistRun: persistSpy,
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Fail',
      maxSteps: 5,
    });

    expect(result.status).toBe('failed');
    // persistRun should be called at least once (the final persist after failure)
    expect(persistSpy).toHaveBeenCalled();
    const lastCall = persistSpy.mock.calls[persistSpy.mock.calls.length - 1] as unknown[];
    const persistedRun = lastCall[0] as { status: string };
    expect(persistedRun.status).toBe('failed');
  });

  it('uses "global" memory collection when workspaceId is not set', async () => {
    const searchSpy = vi.fn(async () => []);
    const upsertSpy = vi.fn(async () => {});

    const mockMemory = {
      search: searchSpy,
      upsert: upsertSpy,
    } as unknown as import('@titan/memory').MemoryClient;

    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'unused' }),
      memory: mockMemory,
    });

    await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello',
      maxSteps: 3,
      // no workspaceId
    });

    expect(searchSpy).toHaveBeenCalledWith('global', 'Hello', { limit: 5 });
    const upsertCall = upsertSpy.mock.calls[0] as unknown[];
    expect(upsertCall[0]).toBe('global');
  });

  it('generates a unique runId when not provided', async () => {
    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'unused' }),
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello',
      maxSteps: 1,
    });

    expect(result.id).toBeDefined();
    expect(result.id.length).toBeGreaterThan(0);
    // UUID format check
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('uses provided runId when given', async () => {
    const runner = new AgentRunner({
      llm: new MockEchoProvider(),
      executeTool: async () => ({ success: false, error: 'unused' }),
    });

    const result = await runner.run({
      agentId: 'test-agent',
      prompt: 'Hello',
      maxSteps: 1,
      runId: 'custom-run-id-123',
    });

    expect(result.id).toBe('custom-run-id-123');
  });
});
