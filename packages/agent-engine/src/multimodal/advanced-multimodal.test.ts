import { describe, it, expect, beforeEach } from 'vitest';
import { AdvancedMultimodal } from './advanced-multimodal.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('AdvancedMultimodal', () => {
  let am: AdvancedMultimodal;

  beforeEach(() => {
    am = new AdvancedMultimodal(new MockEchoProvider());
  });

  it('should extract PDF tables', async () => {
    const tables = await am.extractPDFTables('Some PDF content with tables');
    expect(Array.isArray(tables)).toBe(true);
  });

  it('should extract code from screenshot', async () => {
    const result = await am.codeFromScreenshot('a code editor showing TypeScript');
    expect(result.language).toBeDefined();
    expect(result.code).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should convert diagram to code', async () => {
    const result = await am.diagramToCode('a flowchart with 3 nodes');
    expect(result.diagramType).toBeDefined();
    expect(result.generatedCode).toBeDefined();
  });

  it('should understand charts', async () => {
    const result = await am.understandChart('a bar chart with 5 bars');
    expect(result.chartType).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    const result = await am.codeFromScreenshot('');
    expect(result).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});
