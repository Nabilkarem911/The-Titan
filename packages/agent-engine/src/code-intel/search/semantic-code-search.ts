import type { CodebaseIndex } from '../indexer/codebase-index.js';
import type { CrawledFile } from '../indexer/file-crawler.js';
import type { CodeSymbol } from '../indexer/symbol-extractor.js';


export interface SearchResult {
  file: CrawledFile;
  score: number;
  matchedSymbols: CodeSymbol[];
  matchedLines: Array<{ line: number; content: string }>;
  reason: string;
}

export function searchCode(index: CodebaseIndex, query: string, limit = 10): SearchResult[] {
  const queryWords = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const results: SearchResult[] = [];

  for (const file of index.files) {
    let score = 0;
    const matchedSymbols: CodeSymbol[] = [];
    const matchedLines: Array<{ line: number; content: string }> = [];
    const reasons: string[] = [];

    // Deprioritize test files — they contain query words but aren't source code
    const isTestFile = file.relativePath.includes('.test.') || file.relativePath.includes('.spec.');

    // Symbol name matching (highest weight — most reliable signal)
    const fileSymbols = index.symbols.filter((s) => s.filePath === file.relativePath);
    for (const sym of fileSymbols) {
      const symWords = splitCamelCase(sym.name).map((w) => w.toLowerCase());
      const overlap = symWords.filter((w) => queryWords.has(w)).length;
      if (overlap > 0) {
        score += overlap * 8 + (sym.exported ? 4 : 0);
        matchedSymbols.push(sym);
        reasons.push(`symbol: ${sym.name}`);
      }
    }

    // File path matching (high weight — strong signal)
    const pathWords = file.relativePath.toLowerCase().split(/[/\\._-]/);
    const pathOverlap = pathWords.filter((w) => queryWords.has(w)).length;
    if (pathOverlap > 0) {
      score += pathOverlap * 6;
      reasons.push(`path: ${file.relativePath}`);
    }

    // Content matching (low weight, capped — prevents verbose files from dominating)
    const lines = file.content.split('\n');
    let contentScore = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      const lineOverlap = [...queryWords].filter((w) => lineLower.includes(w)).length;
      if (lineOverlap >= 2 || (lineOverlap >= 1 && queryWords.size <= 2)) {
        contentScore += lineOverlap;
        if (matchedLines.length < 5) {
          matchedLines.push({ line: i + 1, content: lines[i].trim().slice(0, 200) });
        }
      }
    }
    // Cap content score at 5 — content is a weak signal compared to path/symbol
    score += Math.min(contentScore, 5);

    // Penalize test files so source files always rank higher
    if (isTestFile) {
      score = Math.floor(score * 0.1);
    }

    // Doc comment matching
    for (const sym of fileSymbols) {
      if (sym.docComment) {
        const docWords = sym.docComment.toLowerCase().split(/\s+/);
        const docOverlap = docWords.filter((w) => queryWords.has(w)).length;
        if (docOverlap > 0) {
          score += docOverlap * 2;
          reasons.push(`doc: ${sym.name}`);
        }
      }
    }

    if (score > 0) {
      results.push({
        file,
        score,
        matchedSymbols,
        matchedLines,
        reason: reasons.join(', '),
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function findReferences(index: CodebaseIndex, symbolName: string): Array<{ file: string; line: number; context: string }> {
  const refs: Array<{ file: string; line: number; context: string }> = [];

  for (const file of index.files) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(symbolName)) {
        refs.push({
          file: file.relativePath,
          line: i + 1,
          context: lines[i].trim().slice(0, 200),
        });
      }
    }
  }

  return refs;
}

function splitCamelCase(str: string): string[] {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter((w) => w.length > 1);
}
