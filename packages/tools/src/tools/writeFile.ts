import { writeFile as fsWriteFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getLogger } from '@titan/logging';
import { validateCwd } from '../sandbox.js';

const log = getLogger().child({ component: 'tool-write-file' });

export async function writeFile(input: {
  filePath: string;
  content: string;
  createDirs?: boolean;
}): Promise<{ written: boolean; filePath: string; bytes: number }> {
  const { filePath, content, createDirs = true } = input;
  validateCwd(filePath);
  log.info({ filePath }, 'writing file');

  if (createDirs) {
    await mkdir(dirname(filePath), { recursive: true });
  }

  await fsWriteFile(filePath, content, 'utf-8');
  log.info({ filePath, bytes: content.length }, 'file written');
  return { written: true, filePath, bytes: content.length };
}
