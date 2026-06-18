import { describe, it, expect, vi } from 'vitest';
import { SelfCritic } from './self-critic.js';
import { ErrorAnalyzer } from './error-analyzer.js';
import { ConfidenceScorer } from './confidence-scorer.js';
import { RetryStrategist } from './retry-strategist.js';
import type { AgentRun, AgentStep, LlmProvider } from '../types.js';

function mockLlm(content: string): LlmProvider {
  return {
    complete: vi.fn().mockResolvedValue({ content, tokensUsed: 50, finishReason: 'stop' }),
  };
}

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 'run-1',
    agentId: 'agent-1',
    prompt: 'What is 2+2?',
    status: 'completed',
    maxSteps: 10,
    currentStep: 1,
    tokensUsed: 100,
    steps: [],
    finalAnswer: 'The answer is 4.',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeStep(overrides: Partial<AgentStep> = {}): AgentStep {
  return {
    id: 'step-1',
    runId: 'run-1',
    index: 1,
    status: 'failed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Self Critic ──

describe('SelfCritic', () => {
  it('approves a good answer', async () => {
    const llm = mockLlm(JSON.stringify({
      approved: true,
      issues: [],
      suggestions: [],
    }));

    const critic = new SelfCritic(llm);
    const result = await critic.critique(makeRun());
    expect(result.approved).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects answer with critical issues', async () => {
    const llm = mockLlm(JSON.stringify({
      approved: false,
      issues: [{ severity: 'critical', description: 'Factually incorrect' }],
      suggestions: ['Verify the calculation'],
      revisedAnswer: 'The answer is actually 4.',
    }));

    const critic = new SelfCritic(llm);
    const result = await critic.critique(makeRun());
    expect(result.approved).toBe(false);
    expect(result.issues.length).toBe(1);
    expect(result.revisedAnswer).toBeDefined();
  });

  it('returns not approved when no answer', async () => {
    const critic = new SelfCritic(mockLlm(''));
    const result = await critic.critique(makeRun({ finalAnswer: undefined }));
    expect(result.approved).toBe(false);
  });

  it('quickCheck passes for good answer', async () => {
    const llm = mockLlm('{ "pass": true, "reason": "Correct" }');
    const critic = new SelfCritic(llm);
    const result = await critic.quickCheck('4', 'What is 2+2?');
    expect(result.pass).toBe(true);
  });

  it('quickCheck fails for bad answer', async () => {
    const llm = mockLlm('{ "pass": false, "reason": "Wrong answer" }');
    const critic = new SelfCritic(llm);
    const result = await critic.quickCheck('5', 'What is 2+2?');
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('Wrong answer');
  });

  it('handles LLM failure gracefully', async () => {
    const llm: LlmProvider = {
      complete: vi.fn().mockRejectedValue(new Error('LLM down')),
    };
    const critic = new SelfCritic(llm);
    const result = await critic.critique(makeRun());
    expect(result.approved).toBe(true); // fails open
  });
});

// ── Error Analyzer ──

describe('ErrorAnalyzer', () => {
  it('detects rate limit errors', async () => {
    const analyzer = new ErrorAnalyzer(mockLlm(''));
    const step = makeStep({
      action: { name: 'brave_search', params: { q: 'test' } },
      observation: { success: false, error: 'rate limit exceeded' },
    });

    const result = await analyzer.analyze(step, 'Search for X');
    expect(result.errorType).toBe('tool_failure');
    expect(result.retryable).toBe(true);
  });

  it('detects timeout errors', async () => {
    const analyzer = new ErrorAnalyzer(mockLlm(''));
    const step = makeStep({
      observation: { success: false, error: 'ETIMEDOUT' },
    });

    const result = await analyzer.analyze(step, 'Do something');
    expect(result.errorType).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('detects permission errors as non-retryable', async () => {
    const analyzer = new ErrorAnalyzer(mockLlm(''));
    const step = makeStep({
      observation: { success: false, error: '403 permission denied' },
    });

    const result = await analyzer.analyze(step, 'Access resource');
    expect(result.errorType).toBe('tool_failure');
    expect(result.retryable).toBe(false);
  });

  it('detects forbidden tool errors', async () => {
    const analyzer = new ErrorAnalyzer(mockLlm(''));
    const step = makeStep({
      observation: { success: false, error: 'Tool "execute_bash" is forbidden by rules.' },
    });

    const result = await analyzer.analyze(step, 'Run command');
    expect(result.retryable).toBe(false);
  });

  it('uses LLM for unknown errors', async () => {
    const llm = mockLlm(JSON.stringify({
      errorType: 'reasoning_error',
      rootCause: 'Wrong approach',
      suggestedFix: 'Try a different method',
      retryable: true,
    }));

    const analyzer = new ErrorAnalyzer(llm);
    const step = makeStep({
      observation: { success: false, error: 'some weird error' },
    });

    const result = await analyzer.analyze(step, 'Complex task');
    expect(result.errorType).toBe('reasoning_error');
    expect(result.suggestedFix).toBe('Try a different method');
  });
});

// ── Confidence Scorer ──

describe('ConfidenceScorer', () => {
  it('scores a successful run highly', () => {
    const scorer = new ConfidenceScorer(mockLlm(''));
    const run = makeRun({
      steps: [
        makeStep({ status: 'completed', observation: { success: true, data: 'result' } }),
      ],
      finalAnswer: 'A comprehensive answer with detail.',
    });

    const score = scorer.heuristicScore(run);
    expect(score.overall).toBeGreaterThan(50);
    expect(score.dimensions.factualAccuracy).toBeGreaterThan(50);
  });

  it('scores a failed run poorly', () => {
    const scorer = new ConfidenceScorer(mockLlm(''));
    const run = makeRun({
      steps: [
        makeStep({ status: 'failed', observation: { success: false, error: 'failed' } }),
        makeStep({ status: 'failed', observation: { success: false, error: 'failed again' } }),
      ],
      finalAnswer: 'Max steps reached without explicit completion.',
    });

    const score = scorer.heuristicScore(run);
    expect(score.overall).toBeLessThan(50);
  });

  it('returns zero for no answer', async () => {
    const scorer = new ConfidenceScorer(mockLlm(''));
    const score = await scorer.score(makeRun({ finalAnswer: undefined }));
    expect(score.overall).toBe(0);
  });

  it('blends LLM and heuristic scores', async () => {
    const llm = mockLlm(JSON.stringify({
      overall: 90,
      dimensions: { factualAccuracy: 95, completeness: 85, relevance: 90, coherence: 88 },
      explanation: 'Good answer',
    }));

    const scorer = new ConfidenceScorer(llm);
    const score = await scorer.score(makeRun());
    expect(score.overall).toBeGreaterThan(60);
    expect(score.explanation).toBe('Good answer');
  });
});

// ── Retry Strategist ──

describe('RetryStrategist', () => {
  it('stops retrying after max attempts', async () => {
    const strategist = new RetryStrategist(mockLlm(''));
    const step = makeStep({ observation: { success: false, error: 'something' } });
    const result = await strategist.decide(step, 'prompt', 5);
    expect(result.shouldRetry).toBe(false);
    expect(result.method).toBe('skip');
  });

  it('suggests alternative tool for tool failures', async () => {
    const llm = mockLlm(JSON.stringify({
      errorType: 'tool_failure',
      rootCause: 'API down',
      suggestedFix: 'Use alternative',
      retryable: false,
    }));

    const strategist = new RetryStrategist(llm);
    const step = makeStep({
      action: { name: 'brave_search', params: {} },
      observation: { success: false, error: 'Service unavailable' },
    });

    const tools = [
      { name: 'brave_search', description: 'Search', parameters: { type: 'object' as const, properties: {} } },
      { name: 'http_request', description: 'HTTP', parameters: { type: 'object' as const, properties: {} } },
    ];

    const result = await strategist.decide(step, 'Search for X', 0, tools);
    expect(result.shouldRetry).toBe(true);
    expect(result.method).toBe('alternative_tool');
    expect(result.alternativeTool).toBe('http_request');
  });

  it('retries with same tool for timeout', async () => {
    const strategist = new RetryStrategist(mockLlm(''));
    const step = makeStep({
      action: { name: 'http_request', params: {} },
      observation: { success: false, error: 'ETIMEDOUT' },
    });

    const result = await strategist.decide(step, 'Fetch data', 0);
    expect(result.shouldRetry).toBe(true);
    expect(result.method).toBe('same_tool');
  });
});
