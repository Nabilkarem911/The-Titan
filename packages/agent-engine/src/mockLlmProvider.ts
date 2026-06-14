import type { LlmProvider, LlmMessage, LlmCompletion, ToolCall } from './types.js';

/**
 * Mock LLM provider for testing the ReAct loop without real API costs.
 *
 * Simulates a simple two-step reasoning:
 *  1. First call → asks to run a tool
 *  2. Second call (after observation) → gives final answer
 */
export class MockLlmProvider implements LlmProvider {
  private callCount = 0;

  async complete(messages: LlmMessage[]): Promise<LlmCompletion> {
    this.callCount++;
    const lastUser = messages.filter((m) => m.role === 'user').pop()?.content ?? '';

    if (this.callCount === 1) {
      return {
        content: '',
        toolCalls: [{ name: 'execute_bash', params: { command: 'echo hello' } }],
        tokensUsed: 25,
        finishReason: 'tool_calls',
      };
    }

    return {
      content: `Final answer: the user asked "${lastUser}" and the tool returned successfully.`,
      tokensUsed: 30,
      finishReason: 'stop',
    };
  }
}

/**
 * Another mock that always returns a direct answer (no tool calls).
 */
export class MockEchoProvider implements LlmProvider {
  async complete(messages: LlmMessage[]): Promise<LlmCompletion> {
    const lastUser = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    return {
      content: `Echo: ${lastUser}`,
      tokensUsed: lastUser.length,
      finishReason: 'stop',
    };
  }
}
