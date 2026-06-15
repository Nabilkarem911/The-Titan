import { readFile } from 'node:fs/promises';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-read-file-content' });

export async function readFileRaw(input: {
  filePath: string;
  encoding?: BufferEncoding;
  maxBytes?: number;
}): Promise<{ filePath: string; content: string; truncated: boolean; bytes: number }> {
  const { filePath, encoding = 'utf-8', maxBytes = 200_000 } = input;
  log.info({ filePath }, 'reading file content');

  const raw = await readFile(filePath, encoding);
  const truncated = raw.length > maxBytes;
  const content = truncated ? raw.substring(0, maxBytes) : raw;

  log.info({ filePath, bytes: raw.length, truncated }, 'file read complete');
  return { filePath, content, truncated, bytes: raw.length };
}
