import { readFile, writeFile } from 'node:fs/promises';
import { getLogger } from '@titan/logging';
import { validateCwd } from '../sandbox.js';
import type { PatchFileInput } from '../schemas.js';

const log = getLogger().child({ component: 'tool-patch' });

interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

function parseUnifiedDiff(patch: string): Hunk[] {
  const hunks: Hunk[] = [];
  const lines = patch.split('\n');
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('@@')) {
      const match = lines[i].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (!match) throw new Error(`Invalid hunk header: ${lines[i]}`);
      const hunk: Hunk = {
        oldStart: parseInt(match[1], 10),
        oldLines: parseInt(match[2] ?? '1', 10),
        newStart: parseInt(match[3], 10),
        newLines: parseInt(match[4] ?? '1', 10),
        lines: [],
      };
      i++;
      while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('---')) {
        hunk.lines.push(lines[i]);
        i++;
      }
      hunks.push(hunk);
    } else {
      i++;
    }
  }
  return hunks;
}

export async function patchFile(input: PatchFileInput): Promise<{
  success: boolean;
  message: string;
  linesChanged?: number;
}> {
  const { filePath, patch } = input;

  validateCwd(filePath);
  log.info({ filePath }, 'applying patch');

  try {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      // File may not exist yet (create new)
      content = '';
    }

    const hunks = parseUnifiedDiff(patch);
    const lines = content === '' ? [] : content.split('\n');
    let totalChanged = 0;

    for (const hunk of hunks) {
      const oldStart = hunk.oldStart - 1; // 0-indexed
      const removed: string[] = [];
      const added: string[] = [];

      for (const line of hunk.lines) {
        if (line.startsWith('-')) {
          removed.push(line.slice(1));
        } else if (line.startsWith('+')) {
          added.push(line.slice(1));
        } else if (line.startsWith(' ')) {
          removed.push(line.slice(1));
          added.push(line.slice(1));
        } else if (line.startsWith('\\')) {
          // "\ No newline at end of file" — skip
        }
      }

      // Verify old content matches
      const oldSlice = lines.slice(oldStart, oldStart + removed.length);
      if (oldSlice.join('\n') !== removed.join('\n')) {
        return { success: false, message: `Patch mismatch at line ${hunk.oldStart}` };
      }

      // Apply
      lines.splice(oldStart, removed.length, ...added);
      totalChanged += added.length;
    }

    await writeFile(filePath, lines.join('\n'), 'utf-8');
    log.info({ filePath, hunks: hunks.length, totalChanged }, 'patch applied');
    return { success: true, message: `Patched ${filePath}`, linesChanged: totalChanged };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    log.error({ filePath, err: msg }, 'patch failed');
    return { success: false, message: msg };
  }
}
