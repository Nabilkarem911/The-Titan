import { getLogger } from '@titan/logging';
import type { CodebaseIndex } from '../indexer/codebase-index.js';
import { searchCode } from '../search/semantic-code-search.js';
import { getDependencies, getDependents, getExportedSymbols } from '../indexer/codebase-index.js';

const log = getLogger().child({ component: 'smart-context' });

const MAX_CONTEXT_TOKENS = 8000;
const AVG_CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * AVG_CHARS_PER_TOKEN;

export interface ContextChunk {
  filePath: string;
  content: string;
  relevance: number;
  reason: string;
}

export function buildSmartContext(index: CodebaseIndex, query: string, maxChars = MAX_CONTEXT_CHARS): ContextChunk[] {
  const chunks: ContextChunk[] = [];
  let totalChars = 0;

  // 1. Search for most relevant files
  const searchResults = searchCode(index, query, 15);

  for (const result of searchResults) {
    if (totalChars >= maxChars) break;

    const trimmedContent = trimFileContent(result.file.content, query, maxChars - totalChars);
    if (trimmedContent.length === 0) continue;

    chunks.push({
      filePath: result.file.relativePath,
      content: trimmedContent,
      relevance: result.score,
      reason: result.reason,
    });
    totalChars += trimmedContent.length;
  }

  // 2. Add dependency context for top files
  if (chunks.length > 0 && totalChars < maxChars * 0.8) {
    const topFile = chunks[0].filePath;
    const deps = getDependencies(index, topFile);
    const dependents = getDependents(index, topFile);

    for (const dep of [...deps.slice(0, 3), ...dependents.slice(0, 2)]) {
      if (totalChars >= maxChars) break;

      const file = index.files.find((f) => f.relativePath.includes(dep.replace(/^\.\//, '')));
      if (file && !chunks.some((c) => c.filePath === file.relativePath)) {
        const exports = getExportedSymbols(index, file.relativePath);
        const summary = exports.map((s) => s.signature ?? s.name).join('\n');
        const content = summary.slice(0, 1000);

        if (content) {
          chunks.push({
            filePath: file.relativePath,
            content,
            relevance: 0.5,
            reason: `dependency of ${topFile}`,
          });
          totalChars += content.length;
        }
      }
    }
  }

  log.info({ query: query.slice(0, 50), chunks: chunks.length, totalChars }, 'smart context built');
  return chunks;
}

export function formatContextForLlm(chunks: ContextChunk[]): string {
  if (chunks.length === 0) return '';

  const sections = chunks.map((c) => `--- ${c.filePath} ---\n${c.content}`);
  return `Relevant code from the project:\n\n${sections.join('\n\n')}`;
}

function trimFileContent(content: string, query: string, maxChars: number): string {
  if (content.length <= maxChars) return content;

  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  const lines = content.split('\n');
  const scoredLines: Array<{ index: number; score: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const score = [...queryWords].filter((w) => lower.includes(w)).length;
    // Boost exports, function defs, class defs
    const structureBoost = lower.match(/^(export|function|class|interface|type|const|async)/) ? 2 : 0;
    scoredLines.push({ index: i, score: score + structureBoost });
  }

  // Select top-scoring regions
  scoredLines.sort((a, b) => b.score - a.score);
  const selectedIndices = new Set<number>();

  for (const { index } of scoredLines) {
    // Add context window around each match
    for (let j = Math.max(0, index - 2); j <= Math.min(lines.length - 1, index + 2); j++) {
      selectedIndices.add(j);
    }

    const selected = Array.from(selectedIndices).sort((a, b) => a - b);
    const text = selected.map((i) => lines[i]).join('\n');
    if (text.length >= maxChars) break;
  }

  const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
  const result: string[] = [];
  let lastIndex = -2;

  for (const idx of sorted) {
    if (idx > lastIndex + 1) result.push('...');
    result.push(lines[idx]);
    lastIndex = idx;
  }

  return result.join('\n').slice(0, maxChars);
}
