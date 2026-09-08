import { describe, it, expect } from 'vitest';
import { extractSymbols, extractImports } from './indexer/symbol-extractor.js';
import { buildCodebaseIndex, findSymbol, findFile } from './indexer/codebase-index.js';
import { searchCode } from './search/semantic-code-search.js';
import { buildSmartContext, formatContextForLlm } from './analysis/smart-context.js';
import { getFileStats } from './indexer/file-crawler.js';
import path from 'node:path';

const SAMPLE_TS = `
import { getLogger } from '@titan/logging';
import type { AgentRun } from './types.js';

export interface Config {
  name: string;
  port: number;
}

export class AgentRunner {
  private llm: LlmProvider;

  constructor(deps: AgentRunnerDeps) {
    this.llm = deps.llm;
  }

  async run(input: AgentRunInput): Promise<AgentRun> {
    return {} as AgentRun;
  }
}

export function createRunner(): AgentRunner {
  return new AgentRunner({} as any);
}

export type RunStatus = 'running' | 'completed' | 'failed';

const DEFAULT_MAX_STEPS = 10;
`;

// ── Symbol Extractor ──

describe('extractSymbols', () => {
  it('extracts exported functions', () => {
    const symbols = extractSymbols(SAMPLE_TS, 'test.ts');
    const funcs = symbols.filter((s) => s.kind === 'function');
    expect(funcs.some((f) => f.name === 'createRunner' && f.exported)).toBe(true);
  });

  it('extracts exported classes', () => {
    const symbols = extractSymbols(SAMPLE_TS, 'test.ts');
    const classes = symbols.filter((s) => s.kind === 'class');
    expect(classes.some((c) => c.name === 'AgentRunner' && c.exported)).toBe(true);
  });

  it('extracts interfaces', () => {
    const symbols = extractSymbols(SAMPLE_TS, 'test.ts');
    expect(symbols.some((s) => s.name === 'Config' && s.kind === 'interface')).toBe(true);
  });

  it('extracts types', () => {
    const symbols = extractSymbols(SAMPLE_TS, 'test.ts');
    expect(symbols.some((s) => s.name === 'RunStatus' && s.kind === 'type')).toBe(true);
  });

  it('includes line numbers', () => {
    const symbols = extractSymbols(SAMPLE_TS, 'test.ts');
    for (const sym of symbols) {
      expect(sym.line).toBeGreaterThan(0);
    }
  });
});

describe('extractImports', () => {
  it('extracts ES module imports', () => {
    const imports = extractImports(SAMPLE_TS);
    expect(imports.some((i) => i.source === '@titan/logging')).toBe(true);
    expect(imports.some((i) => i.source === './types.js')).toBe(true);
  });

  it('extracts named imports', () => {
    const imports = extractImports(SAMPLE_TS);
    const logging = imports.find((i) => i.source === '@titan/logging');
    expect(logging?.names).toContain('getLogger');
  });
});

// ── Codebase Index ──

describe('buildCodebaseIndex', () => {
  it('indexes the Titan project', () => {
    const root = path.resolve('packages/agent-engine');
    const index = buildCodebaseIndex(root, 200);

    expect(index.files.length).toBeGreaterThan(5);
    expect(index.symbols.length).toBeGreaterThan(10);
    expect(index.stats.totalFiles).toBeGreaterThan(0);
  });

  it('finds symbols by name', () => {
    const root = path.resolve('packages/agent-engine');
    const index = buildCodebaseIndex(root, 200);

    const results = findSymbol(index, 'AgentRunner');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('AgentRunner');
  });

  it('finds files by query', () => {
    const root = path.resolve('packages/agent-engine');
    const index = buildCodebaseIndex(root, 200);

    const results = findFile(index, 'runner');
    expect(results.length).toBeGreaterThan(0);
  });
});

// ── Code Search ──

describe('searchCode', () => {
  it('finds relevant files for a query', () => {
    const root = path.resolve('packages/agent-engine');
    const index = buildCodebaseIndex(root, 200);

    const results = searchCode(index, 'agent runner execute step');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file.relativePath).toContain('runner');
  });

  it('returns matched symbols', () => {
    const root = path.resolve('packages/agent-engine');
    const index = buildCodebaseIndex(root, 200);

    const results = searchCode(index, 'TaskDecomposer planner');
    const hasPlanner = results.some((r) => r.file.relativePath.includes('planner'));
    expect(hasPlanner).toBe(true);
  });
});

// ── Smart Context ──

describe('buildSmartContext', () => {
  it('builds context for a query', () => {
    const root = path.resolve('packages/agent-engine');
    const index = buildCodebaseIndex(root, 200);

    const chunks = buildSmartContext(index, 'how does the agent runner work');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].filePath).toBeDefined();
  });

  it('formats context for LLM', () => {
    const root = path.resolve('packages/agent-engine');
    const index = buildCodebaseIndex(root, 200);

    const chunks = buildSmartContext(index, 'agent runner');
    const formatted = formatContextForLlm(chunks);
    expect(formatted).toContain('Relevant code');
    expect(formatted).toContain('---');
  });
});

// ── File Stats ──

describe('getFileStats', () => {
  it('computes file stats', () => {
    const stats = getFileStats([
      { path: 'a.ts', relativePath: 'a.ts', extension: '.ts', size: 100, lines: 10, content: '' },
      { path: 'b.ts', relativePath: 'b.ts', extension: '.ts', size: 200, lines: 20, content: '' },
      { path: 'c.js', relativePath: 'c.js', extension: '.js', size: 50, lines: 5, content: '' },
    ]);

    expect(stats.totalFiles).toBe(3);
    expect(stats.totalLines).toBe(35);
    expect(stats.byExtension['.ts']).toBe(2);
    expect(stats.byExtension['.js']).toBe(1);
  });
});
