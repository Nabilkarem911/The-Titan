import { describe, it, expect, beforeEach } from 'vitest';
import { UniversalTranslator } from './universal-translator.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('UniversalTranslator', () => {
  let t: UniversalTranslator;

  beforeEach(() => {
    t = new UniversalTranslator(new MockEchoProvider());
  });

  it('should translate language', async () => {
    const result = await t.translateLanguage('Hello', 'English', 'Arabic');
    expect(result.type).toBe('language');
    expect(result.input).toBe('Hello');
    expect(result.output).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should translate code', async () => {
    const result = await t.translateCode('def add(a, b): return a + b', 'Python', 'TypeScript');
    expect(result.type).toBe('code');
    expect(result.output).toBeDefined();
  });

  it('should translate protocol', async () => {
    const result = await t.translateProtocol('{"type":"test"}', 'JSON-RPC', 'gRPC');
    expect(result.type).toBe('protocol');
  });

  it('should translate modal', async () => {
    const result = await t.translateModal('Hello world', 'text', 'voice');
    expect(result.type).toBe('modal');
  });

  it('should translate domain', async () => {
    const result = await t.translateDomain('Build a REST API', 'business', 'technical');
    expect(result.type).toBe('domain');
  });

  it('should adapt culturally', async () => {
    const result = await t.culturalAdapt('Great job!', 'Japanese');
    expect(result.type).toBe('language');
  });

  it('should list supported languages', () => {
    const langs = t.getSupportedLanguages();
    expect(langs.length).toBeGreaterThan(100);
    expect(langs).toContain('Arabic');
    expect(langs).toContain('English');
  });

  it('should list supported code languages', () => {
    const langs = t.getSupportedCodeLanguages();
    expect(langs).toContain('TypeScript');
    expect(langs).toContain('Python');
  });

  it('should list supported protocols', () => {
    const protocols = t.getSupportedProtocols();
    expect(protocols).toContain('MCP');
    expect(protocols).toContain('A2A');
  });

  it('should handle LLM errors gracefully', async () => {
    const failingLlm = { complete: async () => { throw new Error('fail'); } };
    const ft = new UniversalTranslator(failingLlm as any);
    const result = await ft.translateLanguage('test', 'en', 'ar');
    expect(result.confidence).toBe(0);
    expect(result.output).toBe('');
  });
});
