import pkg from 'pg';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram, setGauge } from '@titan/observability';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const { Pool: PgPool, types } = pkg;

types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  poolMin: number;
  poolMax: number;
  statementTimeout: number;
  logQueries: boolean;
  tls: boolean;
  tlsRejectUnauthorized: boolean;
  slowQueryMs: number;
}

function readConfig(): DbConfig {
  const c = loadConfig();
  return {
    host: c.POSTGRES_HOST,
    port: c.POSTGRES_PORT,
    database: c.POSTGRES_DB,
    user: c.POSTGRES_USER,
    password: c.POSTGRES_PASSWORD,
    poolMin: c.POSTGRES_POOL_MIN,
    poolMax: c.POSTGRES_POOL_MAX,
    statementTimeout: c.POSTGRES_STATEMENT_TIMEOUT,
    logQueries: c.POSTGRES_LOG_QUERIES,
    tls: c.POSTGRES_TLS,
    tlsRejectUnauthorized: c.POSTGRES_TLS_REJECT_UNAUTHORIZED,
    slowQueryMs: c.POSTGRES_SLOW_QUERY_MS,
  };
}

let pool: Pool | null = null;
let tlsVerified = false;
let poolMetricsTimer: ReturnType<typeof setInterval> | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const cfg = readConfig();
  const log = getLogger().child({ component: 'database' });
  const poolOpts: Record<string, unknown> = {
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    min: cfg.poolMin,
    max: cfg.poolMax,
    statement_timeout: cfg.statementTimeout,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'titan-core',
  };
  if (cfg.tls) {
    poolOpts.ssl = { rejectUnauthorized: cfg.tlsRejectUnauthorized };
    log.info({ rejectUnauthorized: cfg.tlsRejectUnauthorized }, 'postgres TLS enabled');
  } else if (loadConfig().NODE_ENV === 'production') {
    if (loadConfig().POSTGRES_ALLOW_NO_TLS) {
      log.warn('postgres TLS disabled in production — explicitly allowed via POSTGRES_ALLOW_NO_TLS=true');
    } else {
      throw new Error('postgres TLS is disabled in production. Set POSTGRES_TLS=true or POSTGRES_ALLOW_NO_TLS=true to override.');
    }
  }
  pool = new PgPool(poolOpts);
  pool.on('error', (err) => {
    log.error({ err }, 'unexpected error on idle database client');
  });
  if (cfg.logQueries) {
    pool.on('connect', () => log.debug('new database client connected'));
  }
  poolMetricsTimer = setInterval(() => {
    if (pool) {
      setGauge('db_pool_total', 'Postgres pool total count', pool.totalCount);
      setGauge('db_pool_idle', 'Postgres pool idle count', pool.idleCount);
      setGauge('db_pool_waiting', 'Postgres pool waiting count', pool.waitingCount);
    }
  }, 10_000);
  poolMetricsTimer.unref();
  return pool;
}

export async function verifyTlsOnStartup(): Promise<boolean> {
  if (tlsVerified) return true;
  const cfg = readConfig();
  if (!cfg.tls) {
    tlsVerified = true;
    return false;
  }
  const log = getLogger().child({ component: 'database' });
  try {
    const r = await query<{ ssl: boolean | string }>("SELECT ssl AS ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()");
    const ssl = r.rows[0]?.ssl;
    if (ssl === true || ssl === 't' || ssl === 'on') {
      log.info('postgres TLS verified on connection');
      tlsVerified = true;
      incCounter('db_tls_verified_total', 'DB TLS verifications', 1);
      return true;
    } else {
      log.error({ ssl }, 'postgres TLS NOT active on this connection');
      incCounter('db_tls_verification_failures_total', 'DB TLS verification failures', 1);
      return false;
    }
  } catch (err) {
    log.error({ err }, 'postgres TLS verification query failed');
    return false;
  }
}

export function isTlsVerified(): boolean {
  return tlsVerified;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const log = getLogger().child({ component: 'database' });
  const cfg = readConfig();
  const start = Date.now();
  try {
    const result = await getPool().query<T>(text, params);
    const duration = Date.now() - start;
    observeHistogram('db_query_duration_ms', 'Database query duration', duration, [1, 5, 25, 100, 500, 2000, 10_000]);
    incCounter('db_queries_total', 'Database queries', 1, { status: 'ok' });
    if (cfg.logQueries) {
      log.debug({ text, duration, rows: result.rowCount }, 'query');
    }
    if (duration > cfg.slowQueryMs) {
      log.warn({ text, duration, slowThresholdMs: cfg.slowQueryMs, rows: result.rowCount }, 'slow query');
      incCounter('db_slow_queries_total', 'Slow queries', 1);
    }
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    incCounter('db_queries_total', 'Database queries', 1, { status: 'error' });
    log.error({ err, text, duration }, 'query failed');
    throw err;
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function ping(): Promise<boolean> {
  const r = await query<{ ok: number }>('SELECT 1 AS ok');
  return r.rows[0]?.ok === 1;
}

export async function closePool(): Promise<void> {
  if (poolMetricsTimer) {
    clearInterval(poolMetricsTimer);
    poolMetricsTimer = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
  tlsVerified = false;
}
