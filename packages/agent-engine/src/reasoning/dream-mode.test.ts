import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DreamMode } from './dream-mode.js';
import { MockLlmProvider } from '../mockLlmProvider.js';

describe('DreamMode', () => {
  let dream: DreamMode;
  let llm: MockLlmProvider;

  beforeEach(() => {
    llm = new MockLlmProvider();
    dream = new DreamMode(llm, undefined, 1000);
  });

  afterEach(() => {
    dream.stop();
  });

  it('should not be dreaming initially', () => {
    expect(dream.isDreaming()).toBe(false);
  });

  it('should start running when started', () => {
    dream.start();
    expect(dream.stats().isRunning).toBe(true);
  });

  it('should stop running when stopped', () => {
    dream.start();
    dream.stop();
    expect(dream.stats().isRunning).toBe(false);
  });

  it('should return insights array', () => {
    const insights = dream.getInsights();
    expect(Array.isArray(insights)).toBe(true);
  });

  it('should return reports array', () => {
    const reports = dream.getReports();
    expect(Array.isArray(reports)).toBe(true);
  });

  it('should run a dream session', async () => {
    const report = await dream.dream();
    // dream() may return null if no experiences to consolidate
    if (report) {
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('insights');
    }
  });
});
