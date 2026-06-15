import { randomUUID } from 'node:crypto';

export interface UuidGenerateResult {
  uuids: string[];
  count: number;
}

export async function uuidGenerate(params: { count?: number }): Promise<UuidGenerateResult> {
  const count = Math.min(params.count ?? 1, 100);
  const uuids = Array.from({ length: count }, () => randomUUID());
  return { uuids, count };
}
