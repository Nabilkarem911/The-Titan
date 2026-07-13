import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const ALLOWED_LOG_DIRS = ['/var/log', '/tmp', '/opt/titan/logs', '/home/titan/logs'];

function validateLogPath(requestedPath: string): string {
  const resolved = resolve(requestedPath);
  const isAllowed = ALLOWED_LOG_DIRS.some(dir => {
    const rel = relative(dir, resolved);
    return !rel.startsWith('..');
  });
  if (!isAllowed) {
    throw new Error(`Log search path must be within allowed directories: ${ALLOWED_LOG_DIRS.join(', ')}`);
  }
  return resolved;
}

export async function logSearch(params: { query: string; path?: string; level?: string; limit?: number; since?: string }): Promise<string> {
  const { query, path = '/var/log', level, limit = 50, since } = params;
  if (!query) throw new Error('query is required');

  const safePath = validateLogPath(path);
  const logFiles = findLogFiles(safePath);
  const results: Array<{ file: string; line: number; content: string; timestamp?: string; level?: string }> = [];
  const sinceDate = since ? new Date(since) : undefined;

  for (const file of logFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length && results.length < limit; i++) {
        const line = lines[i];
        if (!line.includes(query)) continue;
        if (level && !line.toLowerCase().includes(level.toLowerCase())) continue;

        const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/);
        if (sinceDate && timestampMatch) {
          const lineDate = new Date(timestampMatch[0]);
          if (lineDate < sinceDate) continue;
        }

        const levelMatch = line.match(/\b(error|warn|info|debug|fatal|trace)\b/i);
        results.push({ file, line: i + 1, content: line.trim().slice(0, 500), timestamp: timestampMatch?.[0], level: levelMatch?.[1] });
      }
    } catch { /* skip unreadable */ }
  }

  return JSON.stringify({ query, matchCount: results.length, filesSearched: logFiles.length, results });
}

function findLogFiles(dir: string, depth = 2): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isFile() && entry.name.match(/\.(log|txt)$|^syslog$|^messages$/)) {
        files.push(fullPath);
      } else if (entry.isDirectory() && depth > 0 && !entry.name.startsWith('.')) {
        files.push(...findLogFiles(fullPath, depth - 1));
      }
    }
  } catch { /* permission denied */ }

  return files.slice(0, 20);
}
