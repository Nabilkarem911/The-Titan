import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-pdf-read' });
const execFileAsync = promisify(execFile);

export async function pdfRead(input: {
  filePath: string;
  maxChars?: number;
  page?: number;
}): Promise<{ filePath: string; content: string; truncated: boolean; pages?: number }> {
  const { filePath, maxChars = 100_000, page } = input;
  log.info({ filePath, page }, 'reading PDF');

  try {
    const args = [filePath, '-'];
    if (page !== undefined) {
      args.unshift('-f', String(page), '-l', String(page));
    }

    const { stdout } = await execFileAsync('pdftotext', args, { maxBuffer: 10 * 1024 * 1024 });
    const content = stdout.trim();
    const truncated = content.length > maxChars;

    log.info({ filePath, chars: content.length, truncated }, 'PDF read complete');
    return {
      filePath,
      content: truncated ? content.substring(0, maxChars) : content,
      truncated,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      throw new Error('pdftotext is not installed. Install poppler-utils: apt-get install poppler-utils');
    }
    throw new Error(`PDF read failed: ${msg}`);
  }
}
