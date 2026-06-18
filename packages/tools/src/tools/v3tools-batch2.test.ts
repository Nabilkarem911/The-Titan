import { describe, it, expect } from 'vitest';
import { xmlParse } from './xmlParse.js';
import { textSummarize } from './textSummarize.js';
import { entityExtract } from './entityExtract.js';
import { budgetTracker } from './budgetTracker.js';

describe('xmlParse', () => {
  it('parses XML structure', async () => {
    const result = JSON.parse(await xmlParse({ xml: '<root><item>Hello</item><item>World</item></root>' }));
    expect(result.rootElement).toBe('root');
    expect(result.wellFormed).toBe(true);
  });

  it('converts XML to JSON', async () => {
    const result = JSON.parse(await xmlParse({ xml: '<user><name>Nabil</name><age>25</age></user>', action: 'to_json' }));
    expect(result.user).toBeDefined();
  });

  it('extracts by tag', async () => {
    const result = JSON.parse(await xmlParse({ xml: '<list><item>A</item><item>B</item><item>C</item></list>', action: 'extract', xpath: 'item' }));
    expect(result).toEqual(['A', 'B', 'C']);
  });
});

describe('textSummarize', () => {
  it('summarizes text', async () => {
    const text = 'The important key finding is that revenue grew significantly. Sales increased by 40%. The team worked hard. Marketing campaigns were effective. Customer satisfaction improved dramatically.';
    const result = await textSummarize({ text, maxLength: 200 });
    expect(result.length).toBeLessThanOrEqual(250);
    expect(result.length).toBeGreaterThan(10);
  });

  it('creates bullet summary', async () => {
    const text = 'First point is important. Second point matters. Third point is critical.';
    const result = await textSummarize({ text, style: 'bullets' });
    expect(result).toContain('•');
  });

  it('creates TLDR', async () => {
    const text = 'The main conclusion is clear. Supporting evidence is strong. Additional details follow.';
    const result = await textSummarize({ text, style: 'tldr' });
    expect(result).toContain('TL;DR');
  });
});

describe('entityExtract', () => {
  it('extracts emails and URLs', async () => {
    const result = JSON.parse(await entityExtract({ text: 'Contact john@example.com or visit https://titan.dev for more info' }));
    expect(result.byType.email).toContain('john@example.com');
    expect(result.byType.url).toContain('https://titan.dev');
  });

  it('extracts dates and money', async () => {
    const result = JSON.parse(await entityExtract({ text: 'Payment of $5,000.00 due on 2026-01-15' }));
    expect(result.byType.money).toBeDefined();
    expect(result.byType.date).toBeDefined();
  });

  it('filters by type', async () => {
    const result = JSON.parse(await entityExtract({ text: 'john@test.com and https://x.com', types: ['email'] }));
    expect(result.byType.email).toBeDefined();
    expect(result.byType.url).toBeUndefined();
  });
});

describe('budgetTracker', () => {
  it('tracks income and expenses', async () => {
    const result = JSON.parse(await budgetTracker({
      action: 'add',
      entries: [
        { description: 'Salary', amount: 5000, type: 'income', category: 'work' },
        { description: 'Rent', amount: 1500, type: 'expense', category: 'housing' },
      ],
    }));
    expect(result.totalIncome).toBe(5000);
    expect(result.totalExpenses).toBe(1500);
    expect(result.net).toBe(3500);
  });

  it('generates summary with categories', async () => {
    const result = JSON.parse(await budgetTracker({
      action: 'summary',
      entries: [
        { description: 'Rent', amount: 1500, type: 'expense', category: 'housing' },
        { description: 'Food', amount: 500, type: 'expense', category: 'food' },
        { description: 'Salary', amount: 5000, type: 'income', category: 'work' },
      ],
    }));
    expect(result.savingsRate).toBe(60); // (5000-2000)/5000 = 60%
    expect(result.topCategories[0].category).toBe('housing');
  });

  it('forecasts future months', async () => {
    const result = JSON.parse(await budgetTracker({
      action: 'forecast',
      entries: [
        { description: 'Income', amount: 5000, type: 'income', category: 'work' },
        { description: 'Expenses', amount: 3000, type: 'expense', category: 'living' },
      ],
      months: 6,
    }));
    expect(result.forecast.length).toBe(6);
    expect(result.forecast[0].projectedNet).toBeGreaterThan(0);
  });
});
