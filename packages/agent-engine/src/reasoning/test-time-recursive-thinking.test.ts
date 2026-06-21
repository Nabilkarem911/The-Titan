import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestTimeRecursiveThinking } from './test-time-recursive-thinking.js';
import type { LlmProvider } from '../types.js';

function makeMockLLM(responses: string[]): LlmProvider {
  let idx = 0;
  return {
    complete: vi.fn(async () => ({
      content: responses[idx++] ?? responses[responses.length - 1],
      model: 'test-model',
      tokensUsed: { input: 10, output: 20, total: 30 },
      finishReason: 'stop',
    })),
  } as unknown as LlmProvider;
}

const FAST_PASS = JSON.stringify({
  answer: '42',
  selfVerification: 'checked',
  passed: true,
  failureModes: [],
  knowledgeGained: 'none',
  confidence: 90,
});

const FAST_FAIL = JSON.stringify({
  answer: 'maybe 42?',
  selfVerification: 'not sure',
  passed: false,
  failureModes: ['uncertain'],
  knowledgeGained: 'need more analysis',
  confidence: 30,
});

const SLOW_PASS = JSON.stringify({
  answer: '42 is correct',
  selfVerification: 'verified step by step',
  passed: true,
  failureModes: [],
  knowledgeGained: 'decomposition helps',
  confidence: 85,
});

const SLOW_FAIL = JSON.stringify({
  answer: 'still unsure',
  selfVerification: 'cannot verify',
  passed: false,
  failureModes: ['insufficient data'],
  knowledgeGained: 'need external info',
  confidence: 20,
});

const ABSTAIN_NO = JSON.stringify({
  shouldAbstain: false,
  reason: 'confident enough',
});

const ABSTAIN_YES = JSON.stringify({
  shouldAbstain: true,
  reason: 'ambiguous problem',
});

describe('TestTimeRecursiveThinking', () => {
  let trt: TestTimeRecursiveThinking;

  beforeEach(() => {
    trt = new TestTimeRecursiveThinking(makeMockLLM([]), 5, 0.4);
  });

  it('converges with fast solver on simple problems', async () => {
    const llm = makeMockLLM([FAST_PASS, ABSTAIN_NO]);
    trt = new TestTimeRecursiveThinking(llm, 5, 0.4);

    const result = await trt.solve('What is 6*7?');

    expect(result.converged).toBe(true);
    expect(result.solverMode).toBe('fast');
    expect(result.finalAnswer).toBe('42');
    expect(result.abstained).toBe(false);
    expect(result.attempts[0].solverMode).toBe('fast');
    expect(result.attempts[0].depth).toBe(0);
  });

  it('falls back to slow solver when fast fails', async () => {
    const llm = makeMockLLM([FAST_FAIL, SLOW_PASS, ABSTAIN_NO]);
    trt = new TestTimeRecursiveThinking(llm, 5, 0.4);

    const result = await trt.solve('Complex problem');

    expect(result.converged).toBe(true);
    expect(result.solverMode).toBe('slow');
    expect(result.attempts.length).toBe(2);
    expect(result.attempts[0].solverMode).toBe('fast');
    expect(result.attempts[1].solverMode).toBe('slow');
    expect(result.attempts[1].depth).toBe(1);
  });

  it('abstains when confidence is below threshold', async () => {
    const llm = makeMockLLM([FAST_FAIL, SLOW_FAIL, SLOW_FAIL, SLOW_FAIL, SLOW_FAIL, SLOW_FAIL]);
    trt = new TestTimeRecursiveThinking(llm, 5, 0.4);

    const result = await trt.solve('Impossible problem');

    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toContain('below threshold');
    expect(result.success).toBe(false);
    expect(result.finalAnswer).toBe('');
  });

  it('abstains when LLM abstention gate triggers', async () => {
    const llm = makeMockLLM([FAST_PASS, ABSTAIN_YES]);
    trt = new TestTimeRecursiveThinking(llm, 5, 0.4);

    const result = await trt.solve('Ambiguous question');

    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toContain('ambiguous');
  });

  it('accumulates knowledge across attempts', async () => {
    const llm = makeMockLLM([FAST_FAIL, SLOW_PASS, ABSTAIN_NO]);
    trt = new TestTimeRecursiveThinking(llm, 5, 0.4);

    const result = await trt.solve('Problem');

    expect(result.accumulatedKnowledge.length).toBeGreaterThan(0);
    expect(result.accumulatedKnowledge).toContain('need more analysis');
  });

  it('tracks solver mode in stats', async () => {
    const llm1 = makeMockLLM([FAST_PASS, ABSTAIN_NO]);
    const trt1 = new TestTimeRecursiveThinking(llm1, 5, 0.4);
    await trt1.solve('Simple');

    const llm2 = makeMockLLM([FAST_FAIL, SLOW_PASS, ABSTAIN_NO]);
    const trt2 = new TestTimeRecursiveThinking(llm2, 5, 0.4);
    await trt2.solve('Complex');

    const stats1 = trt1.stats();
    expect(stats1.fastSolverUsage).toBe(1);
    expect(stats1.slowSolverUsage).toBe(0);

    const stats2 = trt2.stats();
    expect(stats2.fastSolverUsage).toBe(0);
    expect(stats2.slowSolverUsage).toBe(1);
  });

  it('tracks abstention rate in stats', async () => {
    const llm = makeMockLLM([FAST_FAIL, SLOW_FAIL, SLOW_FAIL, SLOW_FAIL, SLOW_FAIL, SLOW_FAIL]);
    trt = new TestTimeRecursiveThinking(llm, 5, 0.4);
    await trt.solve('Impossible');

    const stats = trt.stats();
    expect(stats.abstentionRate).toBe(100);
  });

  it('can disable fast solver', async () => {
    const llm = makeMockLLM([SLOW_PASS, ABSTAIN_NO]);
    trt = new TestTimeRecursiveThinking(llm, 5, 0.4);

    const result = await trt.solve('Problem', { fastSolverFirst: false });

    expect(result.attempts[0].solverMode).toBe('slow');
    expect(result.attempts[0].strategy).not.toBe('fast-solver');
  });

  it('tracks depth in slow solver attempts', async () => {
    const llm = makeMockLLM([FAST_FAIL, SLOW_FAIL, SLOW_PASS, ABSTAIN_NO]);
    trt = new TestTimeRecursiveThinking(llm, 5, 0.4);

    const result = await trt.solve('Problem');

    expect(result.attempts[1].depth).toBe(1);
    expect(result.attempts[2].depth).toBe(2);
  });

  it('clears results', async () => {
    const llm = makeMockLLM([FAST_PASS, ABSTAIN_NO]);
    trt = new TestTimeRecursiveThinking(llm, 5, 0.4);
    await trt.solve('Test');
    trt.clear();
    expect(trt.getResults().length).toBe(0);
  });
});
