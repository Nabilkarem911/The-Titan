import { watch, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface FileWatchResult {
  path: string;
  event: 'change' | 'rename' | 'timeout' | 'not_found';
  filename?: string;
  size?: number;
  modifiedAt?: string;
  timedOut: boolean;
}

export async function fileWatch(params: {
  path: string;
  timeoutMs?: number;
}): Promise<FileWatchResult> {
  const { path: filePath, timeoutMs = 10_000 } = params;

  if (!filePath) throw new Error('path is required');

  const absPath = resolve(filePath);

  if (!existsSync(absPath)) {
    return { path: absPath, event: 'not_found', timedOut: false };
  }

  return new Promise((resolvePromise) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      watcher.close();
      resolvePromise({ path: absPath, event: 'timeout', timedOut: true });
    }, timeoutMs);

    const watcher = watch(absPath, { persistent: false }, (event, filename) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      watcher.close();

      let size: number | undefined;
      let modifiedAt: string | undefined;
      try {
        const stat = statSync(absPath);
        size = stat.size;
        modifiedAt = stat.mtime.toISOString();
      } catch {
        // File may have been deleted
      }

      resolvePromise({
        path: absPath,
        event: event as 'change' | 'rename',
        filename: filename ?? undefined,
        size,
        modifiedAt,
        timedOut: false,
      });
    });
  });
}
