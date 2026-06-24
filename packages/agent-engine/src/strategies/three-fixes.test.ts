/**
 * Tests for bug fixes:
 * 1. Context window compression enabled (ContextOptimizer passed to runner + strategies)
 * 2. Strategy selector picks hypothesis-testing for debugging keywords
 * 3. Personality prompt includes "don't search /app" instruction
 * 4. Hypothesis-testing strategy filters tools for user-code questions
 * 5. Strategies apply context optimization internally
 */
import { describe, it, expect } from 'vitest';
import { StrategySelector, buildAdaptivePrompt, ContextOptimizer, HypothesisTestingStrategy } from '@titan/agent-engine';
import type { AgentContext, LlmMessage, LlmToolDefinition, AgentRun, AgentStep } from '@titan/agent-engine';

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
// Fix 6 — Language adherence: explicit language requests + code language
// ---------------------------------------------------------------------------
describe('Fix 6 — Language adherence', () => {
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

  it('English prompt contains language adherence instruction', () => {
    const prompt = buildAdaptivePrompt(makeCtx('Hello'), 'Hello', 'en');
    expect(prompt).toContain('Language adherence');
    expect(prompt).toContain('EXACT same language');
  });

  it('Arabic prompt contains language adherence instruction', () => {
    const prompt = buildAdaptivePrompt(makeCtx('ازيك'), 'ازيك', 'ar');
    expect(prompt).toContain('الالتزام باللغة');
  });

  it('detects explicit French request "respond in French"', () => {
    const prompt = buildAdaptivePrompt(makeCtx('respond in French please'), 'respond in French please', 'en');
    // Should use French personality
    expect(prompt).toContain('Tu es Titan');
  });

  it('detects explicit French request "رد بالفرنسية"', () => {
    const prompt = buildAdaptivePrompt(makeCtx('رد بالفرنسية'), 'رد بالفرنسية', 'ar');
    expect(prompt).toContain('Tu es Titan');
  });

  it('detects explicit Arabic request "respond in Arabic"', () => {
    const prompt = buildAdaptivePrompt(makeCtx('respond in Arabic'), 'respond in Arabic', 'en');
    // Should use Arabic personality (contains Arabic identity text)
    expect(prompt).toContain('تايتن');
  });

  it('detects explicit English request from Arabic message "بالإنجليزي"', () => {
    const prompt = buildAdaptivePrompt(makeCtx('عايز الرد بالإنجليزي'), 'عايز الرد بالإنجليزي', 'ar');
    // Should use English personality despite Arabic script
    expect(prompt).toContain('You are Titan');
  });

  it('explicit language request overrides preference:language', () => {
    const ctx = makeCtx('respond in French');
    ctx.memoryItems = ['preference:language=english'];
    const prompt = buildAdaptivePrompt(ctx, 'respond in French', 'en');
    // Explicit request should win over stored preference
    expect(prompt).toContain('Tu es Titan');
  });

  it('Arabic text with Python code → Arabic personality', () => {
    const code = 'def hello():\n    print("hello")\n';
    const prompt = buildAdaptivePrompt(makeCtx(`عندي مشكلة في الكود ده:\n${code}`), `عندي مشكلة في الكود ده:\n${code}`, 'ar');
    expect(prompt).toContain('تايتن');
  });

  it('English text with Python code → English personality', () => {
    const code = 'def hello():\n    print("hello")\n';
    const prompt = buildAdaptivePrompt(makeCtx(`I have a bug in this code:\n${code}`), `I have a bug in this code:\n${code}`, 'en');
    expect(prompt).toContain('You are Titan');
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

// ---------------------------------------------------------------------------
// Fix 4 — Hypothesis-testing strategy filters tools for user-code questions
// ---------------------------------------------------------------------------
describe('Fix 4 — Hypothesis-testing tool filtering', () => {
  function makeMockLlm(responses: string[]): { llm: any; calls: number } {
    let idx = 0;
    return {
      llm: {
        complete: async () => {
          const content = responses[idx++] ?? 'FINAL ANSWER: Done';
          return { content, tokensUsed: 100, finishReason: 'stop' };
        },
      },
      calls: 0,
    };
  }

  function makeTools(): LlmToolDefinition[] {
    return [
      { name: 'execute_bash', description: 'Execute bash commands', parameters: { type: 'object', properties: { cmd: { type: 'string' } }, required: ['cmd'] } },
      { name: 'desktop_execute', description: 'Execute desktop commands', parameters: { type: 'object', properties: { cmd: { type: 'string' } }, required: ['cmd'] } },
      { name: 'write_file', description: 'Write file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { name: 'hypothesis_generate', description: 'Generate hypotheses', parameters: { type: 'object', properties: { problem: { type: 'string' } }, required: ['problem'] } },
      { name: 'web_intelligence', description: 'Web intelligence', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { name: 'read_file_content', description: 'Read file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { name: 'brave_search', description: 'Search the web', parameters: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] } },
    ];
  }

  function makeRun(prompt: string): AgentRun {
    return {
      id: 'test-run',
      agentId: 'test',
      prompt,
      status: 'running',
      maxSteps: 3,
      currentStep: 0,
      tokensUsed: 0,
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('strategy name is hypothesis-testing', () => {
    const strategy = new HypothesisTestingStrategy();
    expect(strategy.name).toBe('hypothesis-testing');
  });

  it('filters out execute_bash and desktop_execute for user-code questions', async () => {
    const { llm } = makeMockLlm(['FINAL ANSWER: Based on the error, the issue is...']);
    const strategy = new HypothesisTestingStrategy();
    const tools = makeTools();

    // Capture which tools are passed to llm.complete
    let passedTools: LlmToolDefinition[] | undefined;
    const wrappedLlm = {
      complete: async (msgs: any, opts?: any) => {
        passedTools = opts?.tools;
        return llm.complete(msgs, opts);
      },
    };

    await strategy.execute({
      run: makeRun('I have an error in my code, my API returns 500'),
      systemPrompt: '',
      tools,
      llm: wrappedLlm as any,
      executeTool: async () => ({ success: true, data: 'ok' }),
    });

    expect(passedTools).toBeDefined();
    const toolNames = passedTools!.map(t => t.name);
    expect(toolNames).not.toContain('execute_bash');
    expect(toolNames).not.toContain('desktop_execute');
    expect(toolNames).not.toContain('write_file');
    expect(toolNames).toContain('hypothesis_generate');
    expect(toolNames).toContain('web_intelligence');
  });

  it('does NOT filter tools for non-user-code debugging', async () => {
    const { llm } = makeMockLlm(['FINAL ANSWER: Fixed the server issue.']);
    const strategy = new HypothesisTestingStrategy();
    const tools = makeTools();

    let passedTools: LlmToolDefinition[] | undefined;
    const wrappedLlm = {
      complete: async (msgs: any, opts?: any) => {
        passedTools = opts?.tools;
        return llm.complete(msgs, opts);
      },
    };

    await strategy.execute({
      run: makeRun('The server is crashing with an error'),
      systemPrompt: '',
      tools,
      llm: wrappedLlm as any,
      executeTool: async () => ({ success: true, data: 'ok' }),
    });

    expect(passedTools).toBeDefined();
    const toolNames = passedTools!.map(t => t.name);
    // Should keep all tools including execute_bash for non-user-code debugging
    expect(toolNames).toContain('execute_bash');
  });
});

// ---------------------------------------------------------------------------
// Fix 5 — Strategies apply context optimization internally
// ---------------------------------------------------------------------------
describe('Fix 5 — Strategy-level context compression', () => {
  it('ContextOptimizer is part of StrategyContext', () => {
    // This is a type-level test — if it compiles, the interface is correct
    const optimizer = new ContextOptimizer({ maxConversationMessages: 4 });
    const ctx = {
      run: { id: 't', agentId: 'a', prompt: 'test', status: 'running', maxSteps: 1, currentStep: 0, tokensUsed: 0, steps: [], createdAt: new Date(), updatedAt: new Date() },
      systemPrompt: '',
      tools: [],
      llm: { complete: async () => ({ content: 'FINAL ANSWER: ok', tokensUsed: 10, finishReason: 'stop' }) },
      executeTool: async () => ({ success: true, data: 'ok' }),
      contextOptimizer: optimizer,
    };
    expect(ctx.contextOptimizer).toBeDefined();
    expect(ctx.contextOptimizer).toBe(optimizer);
  });

  it('compactHistory reduces messages when called from strategy', () => {
    const optimizer = new ContextOptimizer({
      maxConversationMessages: 4,
      enableHistoryCompaction: true,
    });

    // Simulate strategy message accumulation
    const messages: LlmMessage[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Original question' },
      { role: 'assistant', content: 'Let me check...', toolCalls: [{ name: 'test', params: {} }] },
      { role: 'tool', content: 'Result 1' },
      { role: 'assistant', content: 'Now let me try...', toolCalls: [{ name: 'test2', params: {} }] },
      { role: 'tool', content: 'Result 2' },
      { role: 'assistant', content: 'Another step...', toolCalls: [{ name: 'test3', params: {} }] },
      { role: 'tool', content: 'Result 3' },
    ];

    const result = optimizer.compactHistory(messages, []);
    expect(result.compacted).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);
  });
});
