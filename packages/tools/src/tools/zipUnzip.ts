import { stat, readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-zip-unzip' });
const execFileAsync = promisify(execFile);

export async function zipUnzip(input: {
  action: 'zip' | 'unzip' | 'list';
  sourcePath: string;
  destPath?: string;
}): Promise<{ success: boolean; files?: string[]; outputPath?: string; error?: string }> {
  const { action, sourcePath, destPath } = input;
  log.info({ action, sourcePath }, 'zip/unzip operation');

  try {
    if (action === 'list') {
      const { stdout } = await execFileAsync('unzip', ['-l', sourcePath]);
      const lines = stdout.split('\n').slice(3, -3).map((l) => l.trim().split(/\s+/).slice(3).join(' '));
      return { success: true, files: lines.filter(Boolean) };
    }

    if (action === 'unzip') {
      const out = destPath ?? sourcePath.replace(/\.zip$/i, '_extracted');
      await mkdir(out, { recursive: true });
      await execFileAsync('unzip', ['-o', sourcePath, '-d', out]);
      const { stdout } = await execFileAsync('unzip', ['-l', sourcePath]);
      const files = stdout.split('\n').slice(3, -3).map((l) => l.trim().split(/\s+/).slice(3).join(' ')).filter(Boolean);
      log.info({ out, count: files.length }, 'unzip complete');
      return { success: true, files, outputPath: out };
    }

    if (action === 'zip') {
      const out = destPath ?? `${sourcePath}.zip`;
      const s = await stat(sourcePath);
      if (s.isDirectory()) {
        await execFileAsync('zip', ['-r', out, '.'], { cwd: sourcePath });
      } else {
        await execFileAsync('zip', [out, sourcePath]);
      }
      log.info({ out }, 'zip complete');
      return { success: true, outputPath: out };
    }

    return { success: false, error: 'Unknown action. Use zip, unzip, or list.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    log.error({ action, sourcePath, err: msg }, 'zip operation failed');
    return { success: false, error: msg };
  }
}
