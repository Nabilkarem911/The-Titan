import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-database-query' });

const BLOCKED_KEYWORDS = /\b(drop|truncate|delete|update|insert|alter|create|grant|revoke|vacuum|reindex|exec|execute|copy|pg_read_file|pg_write_file|lo_import|lo_export)\b/i;
const SENSITIVE_TABLES = /\b(password_hash|user_secrets|sessions|refresh_token|api_keys\.key_hash)\b/i;

export async function databaseQuery(input: {
  sql: string;
  params?: unknown[];
  limit?: number;
}): Promise<{ rows: unknown[]; count: number; truncated: boolean }> {
  const { sql, params = [], limit = 200 } = input;

  const trimmed = sql.trim();

  if (!trimmed.toUpperCase().startsWith('SELECT')) {
    throw new Error('Only SELECT queries are allowed. The query must start with SELECT.');
  }

  if (trimmed.includes(';')) {
    throw new Error('Multi-statement queries are not allowed (semicolons are blocked).');
  }

  if (BLOCKED_KEYWORDS.test(trimmed)) {
    throw new Error('Only SELECT queries are allowed for safety. Mutating queries are blocked.');
  }

  if (SENSITIVE_TABLES.test(trimmed)) {
    throw new Error('Access to sensitive columns (password_hash, secrets, session tokens) is blocked.');
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
