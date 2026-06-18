import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'file-crawler' });

export interface CrawledFile {
  path: string;
  relativePath: string;
  extension: string;
  size: number;
  lines: number;
  content: string;
}

const DEFAULT_IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.output',
  'coverage', '.nyc_output', '__pycache__', '.venv', 'venv', 'target',
  '.turbo', '.cache', '.docker-data', '.idea', '.vscode',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rs', '.go', '.java', '.kt', '.cs',
  '.rb', '.php', '.swift', '.c', '.cpp', '.h',
  '.vue', '.svelte', '.astro',
  '.sql', '.graphql', '.proto',
  '.json', '.yaml', '.yml', '.toml',
  '.md', '.mdx',
  '.css', '.scss', '.less',
  '.html', '.xml',
  '.sh', '.bash', '.zsh',
  '.dockerfile', '.env.example',
]);

const MAX_FILE_SIZE = 500_000; // 500KB

export function crawlDirectory(rootDir: string, maxFiles = 5000): CrawledFile[] {
  const files: CrawledFile[] = [];
  const gitignorePatterns = loadGitignore(rootDir);

  function walk(dir: string): void {
    if (files.length >= maxFiles) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (DEFAULT_IGNORE.has(entry)) continue;
      if (entry.startsWith('.') && entry !== '.env.example') continue;

      const fullPath = join(dir, entry);
      const relPath = relative(rootDir, fullPath).replace(/\\/g, '/');

      if (gitignorePatterns.some((p) => relPath.includes(p))) continue;

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (!CODE_EXTENSIONS.has(ext) && !entry.match(/^(Dockerfile|Makefile|Procfile)$/i)) continue;
        if (stat.size > MAX_FILE_SIZE) continue;

        try {
          const content = readFileSync(fullPath, 'utf-8');
          files.push({
            path: fullPath,
            relativePath: relPath,
            extension: ext,
            size: stat.size,
            lines: content.split('\n').length,
            content,
          });
        } catch { /* binary or unreadable */ }
      }
    }
  }

  walk(rootDir);
  log.info({ root: rootDir, files: files.length }, 'directory crawled');
  return files;
}

function loadGitignore(rootDir: string): string[] {
  const gitignorePath = join(rootDir, '.gitignore');
  if (!existsSync(gitignorePath)) return [];

  try {
    return readFileSync(gitignorePath, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.replace(/\*/g, '').replace(/\//g, ''));
  } catch {
    return [];
  }
}

export function getFileStats(files: CrawledFile[]): { totalFiles: number; totalLines: number; byExtension: Record<string, number> } {
  const byExtension: Record<string, number> = {};
  let totalLines = 0;

  for (const f of files) {
    totalLines += f.lines;
    byExtension[f.extension] = (byExtension[f.extension] ?? 0) + 1;
  }

  return { totalFiles: files.length, totalLines, byExtension };
}
