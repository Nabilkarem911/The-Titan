/**
 * Bug fix test: systemPromptExtra enhancements reach the LLM + Arabic locale works
 *
 * Before fix: buildSystemPrompt() discarded ctx.systemPrompt when it contained "Titan"
 *             because it fell through to buildAdaptivePrompt() which ignored systemPrompt entirely.
 *             locale was never passed from chat.ts to the runner.
 * After fix:  Enhancement sections (emotion, heuristics, introspection, safety, multimodal)
 *             are extracted from systemPrompt and appended to the adaptive prompt.
 *             locale is passed through AgentRunInput → AgentRun → buildAdaptivePrompt.
 */
import { describe, it, expect } from 'vitest';
import { buildAdaptivePrompt } from '@titan/agent-engine';
import type { AgentContext } from '@titan/agent-engine';

function makeCtx(overrides?: Partial<AgentContext>): AgentContext {
  return {
    run: {
      id: 'test-run',
      agentId: 'test-agent',
      prompt: 'ازيك يا تايتن',
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
    ...overrides,
  };
}

describe('Bug fix — systemPromptExtra enhancements reach the LLM', () => {
  it('Emotional context from systemPrompt appears in the built prompt', () => {
    const ctx = makeCtx({
      systemPrompt: 'You are Titan — a friend.\n\nEmotional context:\n- User\'s dominant emotion: anger\n- Valence: -0.8\n- Response strategy: Be calm and reassuring',
    });

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt, 'en');

    expect(prompt).toContain('Emotional context:');
    expect(prompt).toContain('anger');
    expect(prompt).toContain('Be calm and reassuring');
  });

  it('Heuristic context from systemPrompt appears in the built prompt', () => {
    const ctx = makeCtx({
      systemPrompt: 'You are Titan.\n\nRelevant past heuristics:\n- Always validate paths (confidence: 0.9)\n- Use bash for system commands (confidence: 0.85)',
    });

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt, 'en');

    expect(prompt).toContain('Relevant past heuristics:');
    expect(prompt).toContain('Always validate paths');
    expect(prompt).toContain('0.9');
  });

  it('Safety warning from systemPrompt appears in the built prompt', () => {
    const ctx = makeCtx({
      systemPrompt: 'You are Titan.\n\nSAFETY WARNING: This input matches a known harmful pattern (confirmation_required). Confidence: 0.85. Be extra cautious.',
    });

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt, 'en');

    expect(prompt).toContain('SAFETY WARNING:');
    expect(prompt).toContain('confirmation_required');
  });

  it('Introspection data from systemPrompt appears in the built prompt', () => {
    const ctx = makeCtx({
      systemPrompt: 'You are Titan.\n\nIntrospection data:\n- Total introspections: 5\n- Biases detected: 2\n- Avg confidence: 0.75',
    });

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt, 'en');

    expect(prompt).toContain('Introspection data:');
    expect(prompt).toContain('Total introspections: 5');
  });

  it('Multimodal context from systemPrompt appears in the built prompt', () => {
    const ctx = makeCtx({
      systemPrompt: 'You are Titan.\n\nImage analysis (/tmp/screenshot.png):\n- Detected language: python\n- Extracted code:\ndef hello():\n    print("Hello")\n- Confidence: 0.85',
    });

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt, 'en');

    expect(prompt).toContain('Image analysis');
    expect(prompt).toContain('python');
  });

  it('Non-enhancement parts of systemPrompt (contextBlock) are NOT duplicated', () => {
    const ctx = makeCtx({
      systemPrompt: 'You are Titan — a friend.\n\nUser context:\n- name: John\n\nEmotional context:\n- User\'s dominant emotion: joy',
    });

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt, 'en');

    // Enhancement should appear
    expect(prompt).toContain('Emotional context:');
    // But the "You are Titan" and "User context" should NOT appear (they'd duplicate the personality)
    expect(prompt).not.toContain('User context:\n- name: John');
  });
});

describe('Bug fix — Arabic locale produces Arabic system prompt', () => {
  it('Arabic locale → Arabic personality pack is used', () => {
    const ctx = makeCtx();

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt, 'ar');

    // Arabic personality pack starts with "أنت تايتن"
    expect(prompt).toContain('أنت تايتن');
    expect(prompt).toContain('صديق ذكي');
  });

  it('English locale → English personality pack is used', () => {
    const ctx = makeCtx({
      run: { ...makeCtx().run, prompt: 'Hey Titan, how are you?' },
    });

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt, 'en');

    expect(prompt).toContain('You are Titan');
    expect(prompt).toContain('companion');
  });

  it('No locale → falls back to language detection from user message', () => {
    const ctx = makeCtx({
      run: { ...makeCtx().run, prompt: 'ازيك يا تايتن، عامل ايه؟' },
    });

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt);

    // Egyptian Arabic patterns should be detected
    expect(prompt).toContain('أنت تايتن');
  });

  it('Arabic locale + emotion context → both work together', () => {
    const ctx = makeCtx({
      systemPrompt: 'You are Titan.\n\nEmotional context:\n- User\'s dominant emotion: anger\n- Valence: -0.8\n- Response strategy: كن هادي وطمأن المستخدم',
    });

    const prompt = buildAdaptivePrompt(ctx, ctx.run.prompt, 'ar');

    // Arabic personality
    expect(prompt).toContain('أنت تايتن');
    // Emotion context
    expect(prompt).toContain('Emotional context:');
    expect(prompt).toContain('anger');
  });
});
