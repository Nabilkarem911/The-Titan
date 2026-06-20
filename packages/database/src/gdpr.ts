import { query, withTransaction } from './client.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'gdpr' });

export interface ErasureResult {
  userId: string;
  tablesAffected: number;
  rowsDeleted: number;
  errors: string[];
}

const ERASURE_TABLES = [
  { table: 'sessions', column: 'user_id' },
  { table: 'api_keys', column: 'user_id' },
  { table: 'workspace_members', column: 'user_id' },
  { table: 'plugin_ratings', column: 'user_id' },
] as const;

const ERASURE_TABLE_NAMES = new Set(ERASURE_TABLES.map((t) => t.table));
const ERASURE_COLUMN_NAMES = new Set(ERASURE_TABLES.map((t) => t.column));
const SUMMARY_TABLE_NAMES = new Set([...ERASURE_TABLE_NAMES, 'audit.logs']);

function assertValidIdentifier(name: string, allowed: Set<string>): void {
  if (!allowed.has(name)) {
    throw new Error(`Invalid table or column identifier: ${name}`);
  }
}

export async function eraseUserData(userId: string): Promise<ErasureResult> {
  const errors: string[] = [];
  let rowsDeleted = 0;
  let tablesAffected = 0;

  await withTransaction(async (client) => {
    for (const { table, column } of ERASURE_TABLES) {
      assertValidIdentifier(table, ERASURE_TABLE_NAMES);
      assertValidIdentifier(column, ERASURE_COLUMN_NAMES);
      try {
        const r = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM ${table} WHERE ${column} = $1`,
          [userId],
        );
        const count = Number(r.rows[0].count);
        if (count > 0) {
          await client.query(`DELETE FROM ${table} WHERE ${column} = $1`, [userId]);
          rowsDeleted += count;
          tablesAffected += 1;
          log.info({ userId, table, count }, 'gdpr erased rows');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ userId, table, err: msg }, 'gdpr erase failed');
        errors.push(`${table}: ${msg}`);
      }
    }

    // Anonymize audit logs instead of deleting (retain for compliance)
    try {
      const r = await client.query(
        `UPDATE audit.logs SET actor_id = NULL, metadata = metadata || $1::jsonb WHERE actor_id = $2`,
        [JSON.stringify({ _gdpr_anonymized: true, _gdpr_at: new Date().toISOString() }), userId],
      );
      if ((r.rowCount ?? 0) > 0) {
        tablesAffected += 1;
        log.info({ userId, rows: r.rowCount }, 'gdpr anonymized audit logs');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ userId, err: msg }, 'gdpr audit anonymize failed');
      errors.push(`audit.logs: ${msg}`);
    }
  });

  return { userId, tablesAffected, rowsDeleted, errors };
}

export async function getUserDataSummary(userId: string): Promise<Record<string, number>> {
  const summary: Record<string, number> = {};
  for (const { table } of ERASURE_TABLES) {
    assertValidIdentifier(table, SUMMARY_TABLE_NAMES);
    const r = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${table} WHERE user_id = $1`,
      [userId],
    );
    summary[table] = Number(r.rows[0]?.count ?? 0);
  }
  const auditR = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM audit.logs WHERE actor_id = $1`,
    [userId],
  );
  summary['audit_logs'] = Number(auditR.rows[0]?.count ?? 0);
  return summary;
}
