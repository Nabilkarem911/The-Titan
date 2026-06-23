import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'db-persist' });

export function persist(
  repo: { insert: (id: string, data: Record<string, unknown>) => Promise<void> } | { upsert: (id: string, data: Record<string, unknown>, updateCols: string[]) => Promise<void> },
  id: string,
  data: Record<string, unknown>,
  updateCols?: string[],
): void {
  if ('upsert' in repo && updateCols) {
    repo.upsert(id, data, updateCols).catch((err) => log.warn({ err, id }, 'failed to persist to DB'));
  } else if ('insert' in repo) {
    repo.insert(id, data).catch((err) => log.warn({ err, id }, 'failed to persist to DB'));
  }
}
