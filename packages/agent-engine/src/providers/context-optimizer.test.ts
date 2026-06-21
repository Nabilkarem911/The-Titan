import { describe, it, expect } from 'vitest';
import { ContextOptimizer } from './context-optimizer.js';
import type { LlmMessage, LlmToolDefinition, AgentStep } from '../types.js';

function makeTool(name: string, description = 'A tool', props: Record<string, { type: string; description?: string }> = {}): LlmToolDefinition {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties: props,
      required: Object.keys(props),
    },
  };
}

function makeStep(index: number, actionName?: string): AgentStep {
  return {
    id: `step-${index}`,
    runId: 'run-1',
    index,
    status: 'completed',
    action: actionName ? { name: actionName, params: {} } : undefined,
    observation: actionName ? { success: true, data: 'result data' } : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ContextOptimizer', () => {
  it('estimates tokens for messages and tools', () => {
    const opt = new ContextOptimizer();
    const messages: LlmMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello world' },
    ];
    const tools = [makeTool('tool1', 'Does something useful', { input: { type: 'string', description: 'The input' } })];

    const tokens = opt.estimateTokens(messages, tools);
    expect(tokens).toBeGreaterThan(0);
  });

  it('filters unused tools when over budget', () => {
    const opt = new ContextOptimizer({ maxContextTokens: 100, enableToolFiltering: true });
    const tools: LlmToolDefinition[] = [
      makeTool('execute_bash', 'Execute bash commands', { command: { type: 'string' } }),
      makeTool('rarely_used_tool', 'A tool that is rarely used with a very long description to increase token count'),
      makeTool('another_rare_tool', 'Another rarely used tool with a long description to increase token count further'),
    ];
    const steps: AgentStep[] = [makeStep(0, 'execute_bash')];

    const result = opt.optimizeTools(tools, steps, 'run a command');
    expect(result.tools.length).toBeLessThanOrEqual(tools.length);
    // execute_bash should always be kept (essential)
    expect(result.tools.some(t => t.name === 'execute_bash')).toBe(true);
  });

  it('keeps all tools when under budget', () => {
    const opt = new ContextOptimizer({ maxContextTokens: 100000, enableToolFiltering: true });
    const tools: LlmToolDefinition[] = [
      makeTool('tool_a', 'Tool A'),
      makeTool('tool_b', 'Tool B'),
      makeTool('tool_c', 'Tool C'),
    ];

    const result = opt.optimizeTools(tools, [], 'test prompt');
    expect(result.tools.length).toBe(3);
    expect(result.removed.length).toBe(0);
  });

  it('keeps tools mentioned in prompt', () => {
    const opt = new ContextOptimizer({ maxContextTokens: 100, enableToolFiltering: true });
    const tools: LlmToolDefinition[] = [
      makeTool('execute_bash', 'Execute bash'),
      makeTool('custom_tool', 'A custom tool with a long description to increase token count significantly'),
    ];

    const result = opt.optimizeTools(tools, [], 'please use custom_tool for this task');
    expect(result.tools.some(t => t.name === 'custom_tool')).toBe(true);
  });

  it('compacts long conversation history', () => {
    const opt = new ContextOptimizer({ maxConversationMessages: 5, enableHistoryCompaction: true });
    const messages: LlmMessage[] = [
      { role: 'system', content: 'System prompt' },
      ...Array.from({ length: 20 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`,
      })),
    ];

    const result = opt.compactHistory(messages, []);
    expect(result.compacted).toBe(15);
    expect(result.messages.length).toBeLessThan(messages.length);
    // System messages should be preserved
    const systemMsgs = result.messages.filter(m => m.role === 'system');
    expect(systemMsgs.length).toBeGreaterThanOrEqual(1);
  });

  it('does not compact short history', () => {
    const opt = new ContextOptimizer({ maxConversationMessages: 20, enableHistoryCompaction: true });
    const messages: LlmMessage[] = [
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ];

    const result = opt.compactHistory(messages, []);
    expect(result.compacted).toBe(0);
    expect(result.messages.length).toBe(3);
  });

  it('truncates long tool output', () => {
    const opt = new ContextOptimizer({ maxToolOutputTokens: 100, enableOutputTruncation: true });
    const longContent = 'A'.repeat(1000);
    const result = opt.truncateToolOutput(longContent, 'execute_bash');
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBeLessThan(longContent.length);
    expect(result.content).toContain('truncated');
  });

  it('does not truncate short tool output', () => {
    const opt = new ContextOptimizer({ maxToolOutputTokens: 1000, enableOutputTruncation: true });
    const result = opt.truncateToolOutput('short output', 'execute_bash');
    expect(result.truncated).toBe(false);
    expect(result.content).toBe('short output');
  });

  it('truncation keeps head and tail', () => {
    const opt = new ContextOptimizer({ maxToolOutputTokens: 50, enableOutputTruncation: true });
    const content = 'HEAD_DATA_' + 'X'.repeat(500) + '_TAIL_DATA';
    const result = opt.truncateToolOutput(content, 'read_file');
    expect(result.truncated).toBe(true);
    expect(result.content).toContain('HEAD_DATA');
    expect(result.content).toContain('TAIL_DATA');
  });

  it('records optimization savings', () => {
    const opt = new ContextOptimizer();
    opt.recordOptimization(500);
    opt.recordOptimization(300);
    const stats = opt.getStats();
    expect(stats.totalTokensSaved).toBe(800);
    expect(stats.totalOptimizations).toBe(2);
  });

  it('respects disabled flags', () => {
    const opt = new ContextOptimizer({
      enableToolFiltering: false,
      enableHistoryCompaction: false,
      enableOutputTruncation: false,
    });

    const tools = [makeTool('a', 'Tool A'), makeTool('b', 'Tool B')];
    const toolResult = opt.optimizeTools(tools, [], 'test');
    expect(toolResult.tools.length).toBe(2);

    const messages: LlmMessage[] = Array.from({ length: 50 }, (_, i) => ({ role: 'user' as const, content: `msg ${i}` }));
    const historyResult = opt.compactHistory(messages, []);
    expect(historyResult.compacted).toBe(0);

    const outputResult = opt.truncateToolOutput('A'.repeat(10000), 'test');
    expect(outputResult.truncated).toBe(false);
  });
});
