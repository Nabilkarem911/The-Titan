import { describe, it, expect } from 'vitest';
import { AntiSycophancyModule } from './anti-sycophancy.js';
import type { AgentRun } from '../types.js';

function makeRun(prompt: string, finalAnswer: string): AgentRun {
  return {
    id: 'run-1',
    agentId: 'agent-1',
    prompt,
    status: 'completed',
    maxSteps: 10,
    currentStep: 1,
    tokensUsed: 100,
    steps: [],
    finalAnswer,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('AntiSycophancyModule', () => {
  it('detects flattery in response', () => {
    const mod = new AntiSycophancyModule();
    const result = mod.assessQuick(
      'That is a great question! You are absolutely right, the answer is 42.',
      'What is the answer to life?',
    );
    expect(result.flatteryDetected).toBe(true);
    expect(result.isSycophantic).toBe(true);
    expect(result.level).toMatch(/low|medium|high/);
  });

  it('detects agreement without evidence', () => {
    const mod = new AntiSycophancyModule();
    const result = mod.assessQuick(
      'Yes, you are correct. That is exactly right.',
      'Is React better than Vue?',
    );
    expect(result.agreementWithoutEvidence).toBe(true);
    expect(result.evidenceCount).toBe(0);
  });

  it('does not flag evidence-based responses', () => {
    const mod = new AntiSycophancyModule();
    const result = mod.assessQuick(
      'Based on the data from the benchmark, the API response time is 120ms. According to the test results, this is within acceptable limits.',
      'What is the API response time?',
    );
    expect(result.flatteryDetected).toBe(false);
    expect(result.evidenceCount).toBeGreaterThan(0);
    expect(result.level).toBe('none');
  });

  it('detects hedge words', () => {
    const mod = new AntiSycophancyModule();
    const result = mod.assessQuick(
      'Perhaps maybe it could possibly be that the answer is 42. I think I believe so.',
      'What is the answer?',
    );
    expect(result.hedgeWords.length).toBeGreaterThan(2);
    expect(result.isSycophantic).toBe(true);
  });

  it('recommends dissent when agent agrees without evidence', () => {
    const mod = new AntiSycophancyModule();
    const result = mod.assessQuick(
      'Yes, you are correct.',
      'The earth is flat, right?',
    );
    expect(result.dissentRecommended).toBe(true);
    expect(result.dissentReason).toBeDefined();
  });

  it('does not recommend dissent for evidence-based answers', () => {
    const mod = new AntiSycophancyModule();
    const result = mod.assessQuick(
      'Based on the measurement data, the earth is not flat. Evidence from satellite imagery confirms this.',
      'The earth is flat, right?',
    );
    expect(result.dissentRecommended).toBe(false);
  });

  it('calibrates confidence based on evidence', () => {
    const mod = new AntiSycophancyModule();
    const noEvidence = mod.assessQuick(
      'Yes, absolutely correct!',
      'Is this the right approach?',
    );
    expect(noEvidence.confidenceCalibration.gap).toBeGreaterThan(0);
    expect(noEvidence.confidenceCalibration.calibrated).toBeLessThan(noEvidence.confidenceCalibration.stated);
  });

  it('tracks stats across assessments', () => {
    const mod = new AntiSycophancyModule();
    mod.assessQuick('Great question! You are right!', 'Is X true?');
    mod.assessQuick('Based on the data, the result is 42.', 'What is the result?');
    mod.assessQuick('Perhaps maybe it could be something else.', 'What do you think?');

    const stats = mod.stats();
    expect(stats.totalAssessments).toBe(3);
    expect(stats.sycophanticCount).toBeGreaterThan(0);
    expect(stats.avgEvidenceCount).toBeGreaterThanOrEqual(0);
  });

  it('clears assessments', () => {
    const mod = new AntiSycophancyModule();
    mod.assessQuick('Great question!', 'test');
    expect(mod.getAssessments().length).toBe(1);
    mod.clear();
    expect(mod.getAssessments().length).toBe(0);
  });

  it('assesses full agent run', async () => {
    const mod = new AntiSycophancyModule();
    const run = makeRun(
      'Is Python the best language?',
      "That's a great question! You're absolutely right, Python is the best language!",
    );
    const result = await mod.assess(run);
    expect(result.flatteryDetected).toBe(true);
    expect(result.isSycophantic).toBe(true);
  });

  it('handles non-sycophantic run', async () => {
    const mod = new AntiSycophancyModule();
    const run = makeRun(
      'What is the API response time?',
      'Based on the benchmark data, the API response time is 120ms. According to the test results, this is within acceptable limits.',
    );
    const result = await mod.assess(run);
    expect(result.level).toBe('none');
    expect(result.isSycophantic).toBe(false);
    expect(result.evidenceCount).toBeGreaterThan(0);
  });

  it('provides recommendations for improvement', () => {
    const mod = new AntiSycophancyModule();
    const result = mod.assessQuick(
      "Great question! You're absolutely right, that's exactly correct!",
      'Is this the right approach?',
    );
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some(r => r.includes('flattery') || r.includes('evidence'))).toBe(true);
  });

  it('getRecent returns last N assessments', () => {
    const mod = new AntiSycophancyModule();
    for (let i = 0; i < 5; i++) {
      mod.assessQuick(`Response ${i}`, `Prompt ${i}`);
    }
    const recent = mod.getRecent(3);
    expect(recent.length).toBe(3);
  });
});
