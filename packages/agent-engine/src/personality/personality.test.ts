import { describe, it, expect } from 'vitest';
import { detectLanguage, isArabicDialect } from './language-detector.js';
import { buildAdaptivePrompt } from './prompt-builder.js';
import type { AgentContext } from '../types.js';

// ── Language Detection ──

describe('detectLanguage', () => {
  it('detects Egyptian Arabic', () => {
    expect(detectLanguage('ازيك يا هندسه عامل ايه').language).toBe('arabic-egyptian');
  });

  it('detects Gulf Arabic', () => {
    expect(detectLanguage('شلونك يا خوي وش تبي').language).toBe('arabic-gulf');
  });

  it('detects Levantine Arabic', () => {
    expect(detectLanguage('كيفك شو في عندك هلق').language).toBe('arabic-levantine');
  });

  it('detects Maghreb Arabic', () => {
    expect(detectLanguage('واش لاباس خويا كيفاش').language).toBe('arabic-maghreb');
  });

  it('detects Formal Arabic', () => {
    expect(detectLanguage('نودّ أن نرجو من حضرتك').language).toBe('arabic-formal');
  });

  it('detects English', () => {
    expect(detectLanguage('Hello, how can I deploy this application?').language).toBe('english');
  });

  it('detects French', () => {
    expect(detectLanguage('Bonjour, comment je peux faire ça?').language).toBe('french');
  });

  it('defaults to English for ambiguous text', () => {
    const result = detectLanguage('xyz 123');
    expect(result.language).toBe('english');
    // Low confidence since only the fallback regex matched
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('identifies Arabic dialects correctly', () => {
    expect(isArabicDialect('arabic-egyptian')).toBe(true);
    expect(isArabicDialect('arabic-gulf')).toBe(true);
    expect(isArabicDialect('english')).toBe(false);
    expect(isArabicDialect('french')).toBe(false);
  });
});

// ── Adaptive Prompt Builder ──

describe('buildAdaptivePrompt', () => {
  function makeCtx(overrides?: Partial<AgentContext>): AgentContext {
    return {
      run: { id: 'r1', agentId: 'a1', prompt: 'test', status: 'running', maxSteps: 10, currentStep: 0, tokensUsed: 0, steps: [], createdAt: new Date(), updatedAt: new Date() },
      systemPrompt: '',
      rules: [],
      ...overrides,
    };
  }

  it('generates Egyptian prompt for Egyptian message', () => {
    const prompt = buildAdaptivePrompt(makeCtx(), 'ازيك يا حب عايز اعمل deploy');
    expect(prompt).toContain('تايتن');
    expect(prompt).toContain('عامية مصرية');
    expect(prompt).toContain('صديقك');
  });

  it('generates English prompt for English message', () => {
    const prompt = buildAdaptivePrompt(makeCtx(), 'How do I deploy this to production?');
    expect(prompt).toContain('Titan');
    expect(prompt).toContain('companion');
    expect(prompt).not.toContain('عامية');
  });

  it('generates Gulf prompt for Gulf message', () => {
    const prompt = buildAdaptivePrompt(makeCtx(), 'شلونك يا خوي وش الأخبار');
    expect(prompt).toContain('خليجية');
  });

  it('generates French prompt for French message', () => {
    const prompt = buildAdaptivePrompt(makeCtx(), 'Bonjour, comment déployer?');
    expect(prompt).toContain('Titan');
    expect(prompt).toContain('compagnon');
  });

  it('includes safety guardrails', () => {
    const prompt = buildAdaptivePrompt(makeCtx(), 'Delete all files');
    expect(prompt).toMatch(/(أمان|Safety|destructive|حذف|confirm)/i);
  });

  it('includes context adaptation section', () => {
    const prompt = buildAdaptivePrompt(makeCtx(), 'Help me fix this bug');
    expect(prompt).toMatch(/(تكيف|adaptation|context|سياق)/i);
  });

  it('respects language preference from memory', () => {
    const ctx = makeCtx({ memoryItems: ['preference:language=arabic-gulf'] });
    const prompt = buildAdaptivePrompt(ctx, 'hello');
    expect(prompt).toContain('خليجية');
  });

  it('injects rules', () => {
    const ctx = makeCtx({ rules: [{ type: 'max_steps', value: 5 }] });
    const prompt = buildAdaptivePrompt(ctx, 'test');
    expect(prompt).toContain('Max steps: 5');
  });

  it('injects memory items', () => {
    const ctx = makeCtx({ memoryItems: ['tone:short=true', 'Some relevant fact'] });
    const prompt = buildAdaptivePrompt(ctx, 'test');
    expect(prompt).toContain('tone:short=true');
    expect(prompt).toContain('Some relevant fact');
  });

  it('includes forbidden behaviors', () => {
    const prompt = buildAdaptivePrompt(makeCtx(), 'Hi');
    expect(prompt).toMatch(/(ممنوع|Never do|Forbidden|متقولش|Never say)/);
  });

  it('includes developer relationship', () => {
    const prompt = buildAdaptivePrompt(makeCtx(), 'How do I add a new API endpoint?');
    expect(prompt).toMatch(/(مطور شريك|co-developer|développeur)/);
  });
});
