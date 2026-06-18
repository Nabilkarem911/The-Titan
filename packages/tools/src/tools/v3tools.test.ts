import { describe, it, expect } from 'vitest';
import { spreadsheetCreate } from './spreadsheetCreate.js';
import { csvTransform } from './csvTransform.js';
import { dataVisualize } from './dataVisualize.js';
import { textClassify } from './textClassify.js';
import { codeAnalyze } from './codeAnalyze.js';
import { systemMetrics } from './systemMetrics.js';
import { invoiceGenerate } from './invoiceGenerate.js';
import { reportGenerate } from './reportGenerate.js';
import { pdfCreate } from './pdfCreate.js';

describe('spreadsheetCreate', () => {
  it('creates CSV from data', async () => {
    const result = JSON.parse(await spreadsheetCreate({ data: [['Alice', '30'], ['Bob', '25']], headers: ['Name', 'Age'] }));
    expect(result.content).toContain('Name,Age');
    expect(result.rows).toBe(2);
  });

  it('creates TSV format', async () => {
    const result = JSON.parse(await spreadsheetCreate({ data: [['A', 'B']], format: 'tsv' }));
    expect(result.content).toContain('A\tB');
  });
});

describe('csvTransform', () => {
  it('filters CSV data', async () => {
    const csv = 'name,age\nAlice,30\nBob,25\nCharlie,30';
    const result = await csvTransform({ csv, action: 'filter', column: 'age', value: '30' });
    expect(result).toContain('Alice');
    expect(result).toContain('Charlie');
    expect(result).not.toContain('Bob');
  });

  it('sorts CSV data', async () => {
    const csv = 'name,age\nCharlie,35\nAlice,25\nBob,30';
    const result = await csvTransform({ csv, action: 'sort', column: 'age' });
    const lines = result.split('\n');
    expect(lines[1]).toContain('Alice');
  });

  it('aggregates CSV data', async () => {
    const csv = 'dept,salary\nEng,5000\nEng,6000\nHR,4000';
    const result = await csvTransform({ csv, action: 'aggregate', groupBy: 'dept', column: 'salary', aggregation: 'sum' });
    expect(result).toContain('Eng');
    expect(result).toContain('11000');
  });
});

describe('dataVisualize', () => {
  it('renders bar chart', async () => {
    const result = await dataVisualize({ data: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }], type: 'bar' });
    expect(result).toContain('█');
    expect(result).toContain('A');
  });

  it('renders table', async () => {
    const result = await dataVisualize({ data: [{ label: 'X', value: 5 }], type: 'table' });
    expect(result).toContain('Total');
  });

  it('renders pie chart', async () => {
    const result = await dataVisualize({ data: [{ label: 'A', value: 30 }, { label: 'B', value: 70 }], type: 'pie' });
    expect(result).toContain('%');
  });
});

describe('textClassify', () => {
  it('detects positive sentiment', async () => {
    const result = JSON.parse(await textClassify({ text: 'This is amazing and excellent!', type: 'sentiment' }));
    expect(result.label).toBe('positive');
  });

  it('detects negative sentiment', async () => {
    const result = JSON.parse(await textClassify({ text: 'Terrible and awful experience', type: 'sentiment' }));
    expect(result.label).toBe('negative');
  });

  it('detects language', async () => {
    const result = JSON.parse(await textClassify({ text: 'مرحبا كيف الحال', type: 'language' }));
    expect(result.language).toBe('arabic');
  });

  it('detects intent', async () => {
    const result = JSON.parse(await textClassify({ text: 'How do I deploy this?', type: 'intent' }));
    expect(result.intent).toBe('question');
  });
});

describe('codeAnalyze', () => {
  it('analyzes TypeScript code', async () => {
    const code = `export function hello(name: string): string {\n  return "Hello " + name;\n}`;
    const result = JSON.parse(await codeAnalyze({ code }));
    expect(result.metrics.functions).toBe(1);
    expect(result.language).toBe('typescript');
    expect(result.qualityScore).toBeGreaterThan(0);
  });

  it('detects code issues', async () => {
    const code = `function x() {\n  if (true) {\n    if (true) {\n      if (true) {\n        if (true) {\n          eval("bad");\n        }\n      }\n    }\n  }\n}`;
    const result = JSON.parse(await codeAnalyze({ code }));
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i: string) => i.includes('eval'))).toBe(true);
  });
});

describe('systemMetrics', () => {
  it('returns system metrics', async () => {
    const result = JSON.parse(await systemMetrics({ type: 'all' }));
    expect(result.cpu).toBeDefined();
    expect(result.memory).toBeDefined();
    expect(result.system).toBeDefined();
    expect(result.system.nodeVersion).toContain('v');
  });
});

describe('invoiceGenerate', () => {
  it('generates invoice HTML', async () => {
    const result = JSON.parse(await invoiceGenerate({
      from: { name: 'Titan Corp' },
      to: { name: 'Client Inc' },
      items: [{ description: 'Consulting', quantity: 10, unitPrice: 150 }],
    }));
    expect(result.total).toBe(1500);
    expect(result.html).toContain('INVOICE');
    expect(result.invoiceNumber).toMatch(/^INV-/);
  });
});

describe('reportGenerate', () => {
  it('generates HTML report', async () => {
    const result = await reportGenerate({
      title: 'Q4 Report',
      sections: [{ heading: 'Summary', content: 'Great quarter', data: [{ label: 'Revenue', value: 100000 }] }],
      author: 'Titan',
    });
    expect(result).toContain('Q4 Report');
    expect(result).toContain('Revenue');
  });

  it('generates Markdown report', async () => {
    const result = await reportGenerate({
      title: 'Test Report',
      sections: [{ heading: 'Section 1', content: 'Content here' }],
      format: 'markdown',
    });
    expect(result).toContain('# Test Report');
    expect(result).toContain('## Section 1');
  });
});

describe('pdfCreate', () => {
  it('generates HTML for PDF', async () => {
    const result = JSON.parse(await pdfCreate({ html: '<h1>Hello</h1><p>World</p>', title: 'Test' }));
    expect(result.success).toBe(true);
    expect(result.html).toContain('Hello');
  });
});
