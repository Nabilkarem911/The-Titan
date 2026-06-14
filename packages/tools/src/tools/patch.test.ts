import { describe, it, expect } from 'vitest';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { patchFile } from './patch.js';

const TEST_DIR = join(process.cwd(), 'tmp-tool-test');

async function withTempFile(content: string): Promise<string> {
  await mkdir(TEST_DIR, { recursive: true });
  const path = join(TEST_DIR, `patch-test-${Date.now()}.txt`);
  await writeFile(path, content, 'utf-8');
  return path;
}

describe('patchFile', () => {
  it('applies a simple unified diff', async () => {
    const filePath = await withTempFile('line1\nline2\nline3\n');
    const patch = `--- a/${filePath}
+++ b/${filePath}
@@ -1,3 +1,3 @@
 line1
-line2
+line2_modified
 line3
`;
    const result = await patchFile({ filePath, patch });
    expect(result.success).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('line2_modified');

    await unlink(filePath);
  });

  it('fails on mismatch', async () => {
    const filePath = await withTempFile('A\nB\nC\n');
    const patch = `--- a/${filePath}
+++ b/${filePath}
@@ -1,3 +1,3 @@
 X
-Y
+Z
 C
`;
    const result = await patchFile({ filePath, patch });
    expect(result.success).toBe(false);
    expect(result.message).toContain('mismatch');

    await unlink(filePath);
  });

  it('creates a new file if it does not exist', async () => {
    const filePath = join(TEST_DIR, `patch-new-${Date.now()}.txt`);
    const patch = `--- /dev/null
+++ b/${filePath}
@@ -0,0 +1,2 @@
+hello
+world
`;
    const result = await patchFile({ filePath, patch });
    expect(result.success).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content.trim()).toBe('hello\nworld');

    await unlink(filePath);
  });
});
