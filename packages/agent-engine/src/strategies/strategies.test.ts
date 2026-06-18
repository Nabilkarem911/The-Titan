import { describe, it, expect, vi } from 'vitest';
import { ChainOfThoughtStrategy } from './chain-of-thought.js';
import { TreeOfThoughtStrategy } from './tree-of-thought.js';
import { DebateStrategy } from './debate.js';
import { StrategySelector } from './strategy-selector.js';
import type { StrategyContext } from './types.js';
import type { LlmProvider, AgentRun, LlmCompletion } from '../types.js';

function makeCtx(llmResponses: Array<Partial<LlmCompletion>>): StrategyContext {
  let callIndex = 0;
  const llm: LlmProvider = {
    complete: vi.fn().mockImplementation(async () => {
      const response = llmResponses[Math.min(callIndex, llmResponses.length - 1)];
      callIndex++;
      return {
        content: response.content ?? '',
        toolCalls: response.toolCalls,
        tokensUsed: response.tokensUsed ?? 50,
        finishReason: response.finishReason ?? 'stop',
      };
    }),
  };

  const run: AgentRun = {
    id: 'run-1',
    agentId: 'agent-1',
    prompt: 'Explain quantum computing',
    status: 'running',
    maxSteps: 5,
    currentStep: 0,
    tokensUsed: 0,
    steps: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    run,
    systemPrompt: 'You are a helpful assistant.',
    tools: [],
    llm,
    executeTool: vi.fn().mockResolvedValue({ success: true, data: 'Tool result' }),
    onStep: vi.fn(),
  };
}

// ── Chain of Thought ──

describe('ChainOfThoughtStrategy', () => {
  it('produces a final answer', async () => {
    const ctx = makeCtx([
      { content: 'Let me think step by step...' },
      { content: 'FINAL ANSWER: Quantum computing uses qubits.' },
    ]);

    const strategy = new ChainOfThoughtStrategy();
    const result = await strategy.execute(ctx);

    expect(result.strategyUsed).toBe('chain-of-thought');
    expect(result.finalAnswer).toBe('Quantum computing uses qubits.');
    expect(result.steps.length).toBe(2);
    expect(result.tokensUsed).toBe(100);
  });

  it('handles tool calls mid-reasoning', async () => {
    const ctx = makeCtx([
      { content: 'I need to search', toolCalls: [{ name: 'brave_search', params: { q: 'quantum' } }] },
      { content: 'FINAL ANSWER: Based on research, qubits are...' },
    ]);

    const strategy = new ChainOfThoughtStrategy();
    const result = await strategy.execute(ctx);

    expect(result.finalAnswer).toBe('Based on research, qubits are...');
    expect(ctx.executeTool).toHaveBeenCalledOnce();
  });

  it('falls back when max steps reached without FINAL ANSWER', async () => {
    const ctx = makeCtx([
      { content: 'Thinking...' },
      { content: 'Still thinking...' },
      { content: 'More thinking...' },
      { content: 'Almost there...' },
      { content: 'Last thought without final answer.' },
    ]);

    const strategy = new ChainOfThoughtStrategy();
    const result = await strategy.execute(ctx);

    expect(result.finalAnswer).toBe('Last thought without final answer.');
    expect(result.steps.length).toBe(5);
  });
});

// ── Tree of Thought ──

describe('TreeOfThoughtStrategy', () => {
  it('generates branches and selects best answer', async () => {
    const ctx = makeCtx([
      // Branch generation
      {
        content: JSON.stringify({
          approaches: [
            { description: 'Approach A: Classical analogy', reasoning: 'Compare to bits' },
            { description: 'Approach B: Mathematical', reasoning: 'Use linear algebra' },
          ],
        }),
      },
      // Branch A development
      { content: 'FINAL ANSWER: Qubits are like supercharged bits.' },
      // Branch B development
      { content: 'FINAL ANSWER: Qubits exist in superposition of |0⟩ and |1⟩.' },
      // Evaluation (if pruning needed)
      {
        content: JSON.stringify({
          evaluations: [
            { branchId: 'x', score: 70, reasoning: 'Good analogy' },
            { branchId: 'y', score: 85, reasoning: 'More precise' },
          ],
        }),
      },
    ]);

    const strategy = new TreeOfThoughtStrategy();
    const result = await strategy.execute(ctx);

    expect(result.strategyUsed).toBe('tree-of-thought');
    expect(result.finalAnswer).toBeDefined();
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('handles invalid branch JSON gracefully', async () => {
    const ctx = makeCtx([
      { content: 'Not valid JSON branches' },
      { content: 'FINAL ANSWER: Fallback answer' },
    ]);

    const strategy = new TreeOfThoughtStrategy();
    const result = await strategy.execute(ctx);

    expect(result.finalAnswer).toBeDefined();
    expect(result.steps.length).toBeGreaterThan(0);
  });
});

// ── Debate ──

describe('DebateStrategy', () => {
  it('runs debate rounds and synthesizes', async () => {
    const ctx = makeCtx([
      // Evidence gathering (no tool call)
      { content: 'I have enough context to debate.' },
      // Round 1: advocate
      { content: 'Quantum computing is revolutionary. Confidence: 85' },
      // Round 1: critic
      { content: 'Quantum computing has major scalability issues. Confidence: 70' },
      // Round 1: innovator
      { content: 'Hybrid classical-quantum systems are the future. Confidence: 75' },
      // Round 2: advocate
      { content: 'Recent breakthroughs prove scalability. Confidence: 90' },
      // Round 2: critic
      { content: 'Error correction remains unsolved. Confidence: 65' },
      // Round 2: innovator
      { content: 'Topological qubits will solve error rates. Confidence: 80' },
      // Round 3: advocate
      { content: 'Google achieved quantum supremacy. Confidence: 92' },
      // Round 3: critic
      { content: 'Supremacy claims are overstated. Confidence: 60' },
      // Round 3: innovator
      { content: 'Practical quantum advantage is 5-10 years away. Confidence: 78' },
      // Judge synthesis
      {
        content: JSON.stringify({
          consensus: 'Quantum computing shows promise but faces challenges in error correction and scalability.',
          winner: 'synthesis',
          reasoning: 'Best elements from all perspectives combined',
        }),
      },
    ]);

    const strategy = new DebateStrategy();
    const result = await strategy.execute(ctx);

    expect(result.strategyUsed).toBe('debate');
    expect(result.finalAnswer).toBeDefined();
    expect(result.finalAnswer!.length).toBeGreaterThan(10);
    expect(result.steps.length).toBeGreaterThan(5);
  });
});

// ── Strategy Selector ──

describe('StrategySelector', () => {
  it('selects chain-of-thought for simple questions', () => {
    const selector = new StrategySelector();
    const classification = selector.classifyWithHeuristics('What is the capital of France?');
    expect(classification.type).toBe('simple_qa');
    expect(classification.recommendedStrategy).toBe('chain-of-thought');
  });

  it('selects debate for controversial topics', () => {
    const selector = new StrategySelector();
    const classification = selector.classifyWithHeuristics('What are the pros and cons of nuclear energy?');
    expect(classification.type).toBe('controversial');
    expect(classification.recommendedStrategy).toBe('debate');
  });

  it('selects tree-of-thought for analytical tasks', () => {
    const selector = new StrategySelector();
    const classification = selector.classifyWithHeuristics('Analyze the performance statistics of this database query');
    expect(classification.type).toBe('analytical');
    expect(classification.recommendedStrategy).toBe('tree-of-thought');
  });

  it('selects chain-of-thought for multi-step tasks', () => {
    const selector = new StrategySelector();
    const classification = selector.classifyWithHeuristics('Build a full REST API server with authentication middleware and deploy it to production using Docker and configure the database with migrations');
    expect(classification.type).toBe('multi_step');
    expect(classification.recommendedStrategy).toBe('chain-of-thought');
  });

  it('returns a valid strategy by name', () => {
    const selector = new StrategySelector();
    const strategy = selector.getStrategy('debate');
    expect(strategy.name).toBe('debate');
  });

  it('falls back to chain-of-thought for unknown strategy', () => {
    const selector = new StrategySelector();
    const strategy = selector.getStrategy('unknown' as any);
    expect(strategy.name).toBe('chain-of-thought');
  });

  it('auto-selects with LLM when available', async () => {
    const llm = mockLlm(JSON.stringify({
      type: 'analytical',
      confidence: 85,
      reasoning: 'Requires data analysis',
    }));

    function mockLlm(content: string): LlmProvider {
      return {
        complete: vi.fn().mockResolvedValue({ content, tokensUsed: 30, finishReason: 'stop' }),
      };
    }

    const selector = new StrategySelector(llm);
    const { strategy, classification } = await selector.autoSelect('Analyze this dataset');
    expect(classification.type).toBe('analytical');
    expect(strategy.name).toBe('tree-of-thought');
  });

  it('falls back to heuristics when LLM fails', async () => {
    const llm: LlmProvider = {
      complete: vi.fn().mockRejectedValue(new Error('LLM down')),
    };

    const selector = new StrategySelector(llm);
    const { strategy } = await selector.autoSelect('What is 2+2?');
    expect(strategy.name).toBe('chain-of-thought');
  });
});
