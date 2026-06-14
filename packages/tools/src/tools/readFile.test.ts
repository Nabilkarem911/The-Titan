import { describe, it, expect } from 'vitest';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { readFileContent, readFileAst } from './readFile.js';

const TEST_DIR = join(process.cwd(), 'tmp-tool-test');

async function withTempFile(content: string): Promise<string> {
  await mkdir(TEST_DIR, { recursive: true });
  const path = join(TEST_DIR, `read-test-${Date.now()}.ts`);
  await writeFile(path, content, 'utf-8');
  return path;
}

describe('readFileContent', () => {
  it('reads file with offset and limit', async () => {
    const filePath = await withTempFile('a\nb\nc\nd\ne\n');
    const result = await readFileContent({ filePath, offset: 1, limit: 2 });
    expect(result.content).toBe('b\nc');
    expect(result.totalLines).toBe(6);
    expect(result.truncated).toBe(true);
    await unlink(filePath);
  });

  it('reads entire file when limit exceeds size', async () => {
    const filePath = await withTempFile('one\ntwo');
    const result = await readFileContent({ filePath, offset: 0, limit: 100 });
    expect(result.content).toBe('one\ntwo');
    expect(result.truncated).toBe(false);
    await unlink(filePath);
  });
});

describe('readFileAst', () => {
  it('returns lightweight AST outline', async () => {
    const code = `import { z } from 'zod';
export const foo = 1;
function bar() {}
class Baz {}
interface Qux {}
`;
    const filePath = await withTempFile(code);
    const result = await readFileAst({ filePath });
    expect(result.type).toBe('Program');
    const types = (result.body as Array<Record<string, unknown>>).map((n) => n.type);
    expect(types).toContain('ImportDeclaration');
    expect(types).toContain('VariableDeclaration');
    expect(types).toContain('FunctionDeclaration');
    expect(types).toContain('ClassDeclaration');
    expect(types).toContain('InterfaceDeclaration');
    await unlink(filePath);
  });
});
