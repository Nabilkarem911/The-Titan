import { createHash } from 'node:crypto';
import { query, withTransaction } from '@titan/database';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';

const log = getLogger().child({ component: 'audit-integrity' });

export interface HashChainEntry {
  id: string;
  prevHash: string;
  thisHash: string;
  ts: string;
}

export function computeHash(prevHash: string, payload: string): string {
  return createHash('sha256').update(prevHash).update('|').update(payload).digest('hex');
}

export async function ensureHashChainTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS audit.hash_chain (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      last_hash     TEXT NOT NULL,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function getLastHash(): Promise<string> {
  await ensureHashChainTable();
  const r = await query<{ last_hash: string }>('SELECT last_hash FROM audit.hash_chain ORDER BY updated_at DESC LIMIT 1');
  return r.rows[0]?.last_hash ?? '0'.repeat(64);
}

export async function setLastHash(h: string): Promise<void> {
  await query('INSERT INTO audit.hash_chain (last_hash) VALUES ($1)', [h]);
}

export async function appendWithHashChain(actorId: string | null, action: string, resource: string | null, resourceId: string | null, metadata: Record<string, unknown>): Promise<{ id: string; hash: string }> {
  const c = loadConfig();
  if (!c.AUDIT_HASH_CHAIN_ENABLED) {
    const r = await query<{ id: string }>(
      `INSERT INTO audit.logs (actor_id, action, resource, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [actorId, action, resource, resourceId, JSON.stringify(metadata)],
    );
    return { id: r.rows[0]?.id ?? '', hash: '' };
  }
  await ensureHashChainTable();
  return withTransaction(async (client) => {
    const lastR = await client.query<{ last_hash: string }>('SELECT last_hash FROM audit.hash_chain ORDER BY updated_at DESC LIMIT 1 FOR UPDATE');
    const prev = lastR.rows[0]?.last_hash ?? '0'.repeat(64);
    const ts = new Date().toISOString();
    const payload = JSON.stringify({ actorId, action, resource, resourceId, metadata, ts });
    const hash = computeHash(prev, payload);
    const r = await client.query<{ id: string }>(
      `INSERT INTO audit.logs (actor_id, action, resource, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [actorId, action, resource, resourceId, JSON.stringify({ ...metadata, _hc_hash: hash, _hc_prev: prev, _hc_ts: ts })],
    );
    await client.query('INSERT INTO audit.hash_chain (last_hash) VALUES ($1)', [hash]);
    incCounter('audit_hash_chain_appends_total', 'Audit hash chain appends', 1);
    return { id: r.rows[0]?.id ?? '', hash };
  });
}

export async function verifyHashChain(limit = 1000): Promise<{ valid: boolean; brokenAt: string | null; checked: number }> {
  const c = loadConfig();
  if (!c.AUDIT_HASH_CHAIN_ENABLED) return { valid: true, brokenAt: null, checked: 0 };
  await ensureHashChainTable();
  const r = await query<{ id: string; metadata: Record<string, unknown>; created_at: string }>(
    `SELECT id, metadata, created_at FROM audit.logs
     WHERE metadata ? '_hc_hash'
     ORDER BY created_at ASC LIMIT $1`,
    [limit],
  );
  let prev = '0'.repeat(64);
  let checked = 0;
  for (const row of r.rows) {
    const md = row.metadata as { _hc_hash: string; _hc_prev: string; _hc_ts: string };
    if (!md._hc_hash || !md._hc_prev) continue;
    if (md._hc_prev !== prev) {
      log.warn({ id: row.id }, 'audit hash chain prev mismatch');
      incCounter('audit_hash_chain_violations_total', 'Audit hash chain violations', 1);
      return { valid: false, brokenAt: row.id, checked };
    }
    prev = md._hc_hash;
    checked += 1;
  }
  return { valid: true, brokenAt: null, checked };
}

export async function getArchiveCount(): Promise<number> {
  const exists = await query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'audit' AND table_name = 'logs_archive') AS ok`,
  );
  if (!exists.rows[0]?.ok) return 0;
  const r = await query<{ c: string }>('SELECT count(*)::text AS c FROM audit.logs_archive');
  return Number(r.rows[0]?.c ?? 0);
}

export async function archiveOlderThan(daysOld: number, batchSize: number): Promise<{ archived: number }> {
  await query(`
    CREATE TABLE IF NOT EXISTS audit.logs_archive (LIKE audit.logs INCLUDING ALL)
  `);
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  let total = 0;
  while (true) {
    const r = await withTransaction(async (client) => {
      const moved = await client.query<{ id: string }>(
        `WITH moved AS (
          DELETE FROM audit.logs
          WHERE id IN (
            SELECT id FROM audit.logs
            WHERE created_at < $1
            ORDER BY created_at ASC
            LIMIT $2
          )
          RETURNING *
        )
        INSERT INTO audit.logs_archive
        SELECT * FROM moved
        RETURNING id`,
        [cutoff, batchSize],
      );
      return moved.rowCount ?? 0;
    });
    if (r === 0) break;
    total += r;
    if (r < batchSize) break;
  }
  incCounter('audit_archived_total', 'Audit logs archived', total);
  log.info({ total, daysOld, batchSize }, 'audit logs archived');
  return { archived: total };
}

export async function getRetentionInfo(): Promise<{ count: number; oldest: string | null; newest: string | null; archiveCount: number }> {
  const r = await query<{ count: string; oldest: string | null; newest: string | null }>(
    `SELECT count(*)::text AS count, min(created_at) AS oldest, max(created_at) AS newest FROM audit.logs`,
  );
  const archCount = await getArchiveCount();
  return {
    count: Number(r.rows[0]?.count ?? 0),
    oldest: r.rows[0]?.oldest ?? null,
    newest: r.rows[0]?.newest ?? null,
    archiveCount: archCount,
  };
}
