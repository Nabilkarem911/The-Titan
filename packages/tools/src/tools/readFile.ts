import { readFile } from 'node:fs/promises';
import { getLogger } from '@titan/logging';
import { validateCwd } from '../sandbox.js';
import type { ReadFileInput, ReadFileAstInput } from '../schemas.js';

const log = getLogger().child({ component: 'tool-read-file' });

export async function readFileContent(input: ReadFileInput): Promise<{
  content: string;
  totalLines: number;
  truncated: boolean;
}> {
  const { filePath, offset, limit } = input;
  validateCwd(filePath);

  log.info({ filePath, offset, limit }, 'reading file');

  const raw = await readFile(filePath, 'utf-8');
  const allLines = raw.split('\n');
  const slice = allLines.slice(offset, offset + limit);
  const truncated = slice.length < allLines.length - offset;

  return {
    content: slice.join('\n'),
    totalLines: allLines.length,
    truncated,
  };
}

export async function readFileAst(input: ReadFileAstInput): Promise<{
  type: string;
  filePath: string;
  body: unknown[];
}> {
  const { filePath } = input;
  validateCwd(filePath);
  log.info({ filePath }, 'reading file AST');

  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  // Lightweight "AST" — just structural outline without full parser
  const body: unknown[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith('import ')) {
      body.push({ type: 'ImportDeclaration', line: i + 1, source: extractString(line) });
    } else if (/^(export\s+)?(const|let|var)\s+/.test(line)) {
      const name = line.match(/(?:const|let|var)\s+(\w+)/)?.[1];
      body.push({ type: 'VariableDeclaration', line: i + 1, name });
    } else if (/^(export\s+)?function\s+/.test(line)) {
      const name = line.match(/function\s+(\w+)/)?.[1];
      body.push({ type: 'FunctionDeclaration', line: i + 1, name });
    } else if (/^(export\s+)?(class|interface)\s+/.test(line)) {
      const kind = line.match(/^(export\s+)?(class|interface)/)?.[2];
      const name = line.match(/(?:class|interface)\s+(\w+)/)?.[1];
      body.push({ type: kind === 'interface' ? 'InterfaceDeclaration' : 'ClassDeclaration', line: i + 1, name });
    }
  }

  return { type: 'Program', filePath, body };
}

function extractString(line: string): string | undefined {
  const m = line.match(/['"]([^'"]+)['"]/);
  return m ? m[1] : undefined;
}
