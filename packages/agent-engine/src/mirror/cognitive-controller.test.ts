import { describe, it, expect, beforeEach } from 'vitest';
import { CognitiveController } from './cognitive-controller.js';
import { MockLlmProvider } from '../mockLlmProvider.js';

describe('CognitiveController', () => {
  let controller: CognitiveController;
  let llm: MockLlmProvider;

  beforeEach(() => {
    llm = new MockLlmProvider();
    controller = new CognitiveController(20);
  });

  it('should start with no narrative', () => {
    expect(controller.getLastNarrative()).toBeNull();
  });

  it('should start with no self-model', () => {
    expect(controller.getLastSelfModel()).toBeNull();
  });

  it('should have empty narrative history initially', () => {
    expect(controller.getNarrativeHistory().length).toBe(0);
  });

  it('should synthesize a narrative from threads', async () => {
    const threadResults = [
      { threadId: '1', type: 'goals' as const, output: 'Complete the task', tokensUsed: 0 },
      { threadId: '2', type: 'reasoning' as const, output: 'Step by step plan', tokensUsed: 0 },
    ];
    const result = await controller.synthesize(llm, threadResults, 'Task context');
    expect(result).toHaveProperty('narrative');
    expect(typeof result.narrative).toBe('string');
  });

  it('should store narrative after synthesis', async () => {
    const threadResults = [
      { threadId: '1', type: 'reasoning' as const, output: 'Thinking', tokensUsed: 0 },
    ];
    await controller.synthesize(llm, threadResults, 'Test context');
    expect(controller.getLastNarrative()).not.toBeNull();
    expect(controller.getNarrativeHistory().length).toBe(1);
  });
});
