import { getLogger } from '@titan/logging';
import { crawlDirectory, type CrawledFile, getFileStats } from './file-crawler.js';
import { extractSymbols, extractImports, type CodeSymbol } from './symbol-extractor.js';

const log = getLogger().child({ component: 'codebase-index' });

export interface CodebaseIndex {
  rootDir: string;
  files: CrawledFile[];
  symbols: CodeSymbol[];
  importGraph: Map<string, string[]>;
  stats: { totalFiles: number; totalLines: number; totalSymbols: number; byExtension: Record<string, number> };
  indexedAt: Date;
}

export function buildCodebaseIndex(rootDir: string, maxFiles = 5000): CodebaseIndex {
  const start = performance.now();
  const files = crawlDirectory(rootDir, maxFiles);
  const symbols: CodeSymbol[] = [];
  const importGraph = new Map<string, string[]>();

  for (const file of files) {
    const fileSymbols = extractSymbols(file.content, file.relativePath);
    symbols.push(...fileSymbols);

    const imports = extractImports(file.content);
    const deps = imports.map((i) => i.source);
    if (deps.length > 0) {
      importGraph.set(file.relativePath, deps);
    }
  }

  const fileStats = getFileStats(files);
  const index: CodebaseIndex = {
    rootDir,
    files,
    symbols,
    importGraph,
    stats: { ...fileStats, totalSymbols: symbols.length },
    indexedAt: new Date(),
  };

  const durationMs = Math.round(performance.now() - start);
  log.info({
    root: rootDir,
    files: files.length,
    symbols: symbols.length,
    durationMs,
  }, 'codebase indexed');

  return index;
}

export function findSymbol(index: CodebaseIndex, name: string): CodeSymbol[] {
  const lower = name.toLowerCase();
  return index.symbols.filter((s) => s.name.toLowerCase().includes(lower));
}

export function findFile(index: CodebaseIndex, query: string): CrawledFile[] {
  const lower = query.toLowerCase();
  return index.files
    .filter((f) => f.relativePath.toLowerCase().includes(lower))
    .sort((a, b) => a.relativePath.length - b.relativePath.length);
}

export function getDependents(index: CodebaseIndex, filePath: string): string[] {
  const dependents: string[] = [];
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const [file, deps] of index.importGraph) {
    if (deps.some((d) => normalizedPath.includes(d.replace(/^\.\//, '').replace(/\.\w+$/, '')))) {
      dependents.push(file);
    }
  }

  return dependents;
}

export function getDependencies(index: CodebaseIndex, filePath: string): string[] {
  return index.importGraph.get(filePath) ?? [];
}

export function getExportedSymbols(index: CodebaseIndex, filePath?: string): CodeSymbol[] {
  return index.symbols.filter((s) => s.exported && (!filePath || s.filePath === filePath));
}
