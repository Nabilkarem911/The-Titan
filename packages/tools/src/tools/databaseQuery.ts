import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-database-query' });

const BLOCKED_KEYWORDS = /\b(drop|truncate|delete|update|insert|alter|create|grant|revoke|vacuum|reindex)\b/i;

export async function databaseQuery(input: {
  sql: string;
  params?: unknown[];
  limit?: number;
}): Promise<{ rows: unknown[]; count: number; truncated: boolean }> {
  const { sql, params = [], limit = 200 } = input;

  if (BLOCKED_KEYWORDS.test(sql)) {
    throw new Error('Only SELECT queries are allowed for safety. Mutating queries are blocked.');
  }

  log.info({ sql: sql.substring(0, 200) }, 'database query');

  const { query } = await import('@titan/database');

  const safeSql = sql.trimEnd().replace(/;+$/, '');
  const limitedSql = /\blimit\b/i.test(safeSql)
    ? safeSql
    : `${safeSql} LIMIT ${limit}`;

  const result = await query<Record<string, unknown>>(limitedSql, params);
  const truncated = result.rows.length >= limit;

  log.info({ count: result.rows.length, truncated }, 'query complete');
  return { rows: result.rows, count: result.rows.length, truncated };
}
