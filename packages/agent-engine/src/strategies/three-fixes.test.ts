/**
 * Tests for 3 bug fixes:
 * 1. Context window compression enabled (ContextOptimizer passed to runner)
 * 2. Strategy selector picks hypothesis-testing for debugging keywords
 * 3. Personality prompt includes "don't search /app" instruction
 */
import { describe, it, expect } from 'vitest';
import { StrategySelector, buildAdaptivePrompt, ContextOptimizer } from '@titan/agent-engine';
import type { AgentContext, LlmMessage } from '@titan/agent-engine';

// ---------------------------------------------------------------------------
// Fix 2 — Strategy Selector picks hypothesis-testing for debugging
// ---------------------------------------------------------------------------
describe('Fix 2 — Strategy Selector debugging detection', () => {
  const selector = new StrategySelector();

  it('selects hypothesis-testing for "error" keyword', () => {
    const result = selector.classifyWithHeuristics('I have an error in my code');
    expect(result.type).toBe('debugging');
    expect(result.recommendedStrategy).toBe('hypothesis-testing');
  });

  it('selects hypothesis-testing for "bug" keyword', () => {
    const result = selector.classifyWithHeuristics('There is a bug in the authentication flow');
    expect(result.type).toBe('debugging');
    expect(result.recommendedStrategy).toBe('hypothesis-testing');
  });

  it('selects hypothesis-testing for "not working" phrase', () => {
    const result = selector.classifyWithHeuristics('My API is not working properly');
    expect(result.type).toBe('debugging');
    expect(result.recommendedStrategy).toBe('hypothesis-testing');
  });

  it('selects hypothesis-testing for Arabic "مشكلة"', () => {
    const result = selector.classifyWithHeuristics('عندي مشكلة في الـ API');
    expect(result.type).toBe('debugging');
    expect(result.recommendedStrategy).toBe('hypothesis-testing');
  });

  it('selects hypothesis-testing for Arabic "مش شغال"', () => {
    const result = selector.classifyWithHeuristics('الـ endpoint مش شغال');
    expect(result.type).toBe('debugging');
    expect(result.recommendedStrategy).toBe('hypothesis-testing');
  });

  it('selects hypothesis-testing for Arabic "بيفشل"', () => {
    const result = selector.classifyWithHeuristics('الـ test بيفشل كل مرة');
    expect(result.type).toBe('debugging');
    expect(result.recommendedStrategy).toBe('hypothesis-testing');
  });

  it('selects hypothesis-testing for Arabic "بترجع"', () => {
    const result = selector.classifyWithHeuristics('الـ function بترجع null بدل string');
    expect(result.type).toBe('debugging');
    expect(result.recommendedStrategy).toBe('hypothesis-testing');
  });

  it('still selects chain-of-thought for simple factual questions', () => {
    const result = selector.classifyWithHeuristics('What is the capital of France?');
    expect(result.type).toBe('simple_qa');
    expect(result.recommendedStrategy).toBe('chain-of-thought');
  });

  it('getStrategy returns hypothesis-testing strategy instance', () => {
    const strategy = selector.getStrategy('hypothesis-testing');
    expect(strategy.name).toBe('hypothesis-testing');
  });
});

// ---------------------------------------------------------------------------
// Fix 3 — Personality prompt includes "don't search /app"
// ---------------------------------------------------------------------------
describe('Fix 3 — Personality prompt /app instruction', () => {
  function makeCtx(prompt: string): AgentContext {
    return {
      run: {
        id: 'test',
        agentId: 'a',
        prompt,
        status: 'running',
        maxSteps: 10,
        currentStep: 0,
        tokensUsed: 0,
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      systemPrompt: '',
      rules: [],
    };
  }

  it('English prompt contains /app warning', () => {
    const prompt = buildAdaptivePrompt(makeCtx('Hey, can you help me?'), 'Hey, can you help me?', 'en');
    expect(prompt).toContain('Do NOT search /app');
    expect(prompt.toLowerCase()).toContain("user's code, not yours");
  });

  it('Arabic prompt contains /app warning', () => {
    const prompt = buildAdaptivePrompt(makeCtx('ازيك'), 'ازيك', 'ar');
    expect(prompt).toContain('متفتشش في /app');
    expect(prompt).toContain('كود المستخدم');
  });
});

// ---------------------------------------------------------------------------
// Fix 1 — Context window compression works
// ---------------------------------------------------------------------------
describe('Fix 1 — Context window compression', () => {
  it('ContextOptimizer compacts history when messages exceed max', () => {
    const optimizer = new ContextOptimizer({
      maxConversationMessages: 4,
      enableHistoryCompaction: true,
    });

    // Build messages: 1 system + 10 non-system
    const messages: LlmMessage[] = [
      { role: 'system', content: 'You are Titan.' },
    ];
    for (let i = 0; i < 10; i++) {
      messages.push({ role: 'user', content: `Message ${i} with some content`.repeat(10) });
      messages.push({ role: 'assistant', content: `Response ${i} with some content`.repeat(10) });
    }

    const result = optimizer.compactHistory(messages, []);
    expect(result.compacted).toBeGreaterThan(0);
    // System message should be preserved
    expect(result.messages[0].role).toBe('system');
    // Should have a compacted summary message
    expect(result.messages.some(m => m.content.includes('compacted'))).toBe(true);
    // Total messages should be reduced
    expect(result.messages.length).toBeLessThan(messages.length);
  });

  it('ContextOptimizer truncates tool output', () => {
    const optimizer = new ContextOptimizer({
      maxToolOutputTokens: 100, // 400 chars
      enableOutputTruncation: true,
    });

    const longOutput = 'A'.repeat(2000);
    const result = optimizer.truncateToolOutput(longOutput, 'execute_bash');
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBeLessThan(longOutput.length);
    expect(result.content).toContain('truncated');
  });

  it('ContextOptimizer filters tools when over budget', () => {
    const optimizer = new ContextOptimizer({
      maxContextTokens: 100, // Very low to force filtering
      enableToolFiltering: true,
    });

    // Create many tools to exceed budget
    const tools = Array.from({ length: 50 }, (_, i) => ({
      name: `tool_${i}`,
      description: `Tool number ${i} with a description that is long enough to take tokens`.repeat(5),
      parameters: {
        type: 'object' as const,
        properties: { arg: { type: 'string', description: 'test' } },
        required: ['arg'],
      },
    }));

    const result = optimizer.optimizeTools(tools, [], 'test prompt');
    expect(result.tools.length).toBeLessThan(tools.length);
    expect(result.removed.length).toBeGreaterThan(0);
  });

  it('ContextOptimizer does not compact when under limit', () => {
    const optimizer = new ContextOptimizer({
      maxConversationMessages: 20,
      enableHistoryCompaction: true,
    });

    const messages: LlmMessage[] = [
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ];

    const result = optimizer.compactHistory(messages, []);
    expect(result.compacted).toBe(0);
    expect(result.messages.length).toBe(3);
  });
});
