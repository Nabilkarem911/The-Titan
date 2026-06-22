import { describe, it, expect, beforeEach } from 'vitest';
import { IntrospectiveAwareness } from './introspective-awareness.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('IntrospectiveAwareness', () => {
  let ia: IntrospectiveAwareness;

  beforeEach(() => {
    ia = new IntrospectiveAwareness(new MockEchoProvider());
  });

  it('should initialize with a self model', () => {
    const model = ia.getSelfModel();
    expect(model.capabilities.length).toBeGreaterThan(0);
    expect(model.values.length).toBeGreaterThan(0);
    expect(model.confidenceLevel).toBeGreaterThanOrEqual(0);
  });

  it('should introspect and return a record', async () => {
    const record = await ia.introspect('user asked a difficult question');
    expect(record.trigger).toBe('user asked a difficult question');
    expect(record.confidenceLevel).toBeGreaterThanOrEqual(0);
    expect(record.confidenceLevel).toBeLessThanOrEqual(1);
  });

  it('should update self model after introspection', async () => {
    const before = ia.getSelfModel();
    await ia.introspect('test trigger');
    const after = ia.getSelfModel();
    expect(after.lastUpdated.getTime()).toBeGreaterThanOrEqual(before.lastUpdated.getTime());
  });

  it('should record introspections', async () => {
    await ia.introspect('trigger 1');
    await ia.introspect('trigger 2');
    expect(ia.getIntrospections()).toHaveLength(2);
  });

  it('should perform metacognition checks', async () => {
    const check = await ia.metacognitionCheck('Am I sure about this?');
    expect(check.question).toBe('Am I sure about this?');
    expect(check.uncertainty).toBeGreaterThanOrEqual(0);
    expect(check.uncertainty).toBeLessThanOrEqual(1);
  });

  it('should record metacognition checks', async () => {
    await ia.metacognitionCheck('q1');
    await ia.metacognitionCheck('q2');
    expect(ia.getMetacognitionChecks()).toHaveLength(2);
  });

  it('should detect biases in reasoning', () => {
    const biases = ia.detectBias('I only looked at evidence that supports my hypothesis');
    expect(biases).toContain('confirmation bias');
  });

  it('should detect sunk cost bias', () => {
    const biases = ia.detectBias('We already invested too much to stop now');
    expect(biases).toContain('sunk cost bias');
  });

  it('should return empty for unbiased reasoning', () => {
    const biases = ia.detectBias('The data shows a clear trend');
    expect(biases).toHaveLength(0);
  });

  it('should update self model', () => {
    ia.updateSelfModel({ confidenceLevel: 0.9 });
    expect(ia.getSelfModel().confidenceLevel).toBe(0.9);
  });

  it('should get stats', async () => {
    await ia.introspect('t1');
    await ia.metacognitionCheck('q1');
    const stats = ia.getStats();
    expect(stats.introspections).toBe(1);
    expect(stats.metacognitionChecks).toBe(1);
  });

  it('should reset', async () => {
    await ia.introspect('t1');
    ia.reset();
    expect(ia.getIntrospections()).toHaveLength(0);
    expect(ia.getMetacognitionChecks()).toHaveLength(0);
  });

  it('should handle LLM errors in introspection', async () => {
    const failingLlm = { complete: async () => { throw new Error('fail'); } };
    const fia = new IntrospectiveAwareness(failingLlm as any);
    const record = await fia.introspect('test');
    expect(record.emotionalState).toBe('neutral');
    expect(record.uncertaintySources).toContain('LLM unavailable');
  });

  it('should handle LLM errors in metacognition', async () => {
    const failingLlm = { complete: async () => { throw new Error('fail'); } };
    const fia = new IntrospectiveAwareness(failingLlm as any);
    const check = await fia.metacognitionCheck('test');
    expect(check.wouldAskHuman).toBe(true);
    expect(check.uncertainty).toBe(1.0);
  });
});
