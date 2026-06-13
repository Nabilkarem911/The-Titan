import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { getPool, closePool } from './client.js';
import { getLogger } from '@titan/logging';

const MIGRATIONS_TABLE = 'titan_migrations';

function resolveMigrationsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, '..', 'migrations'), resolve(here, '..', '..', 'migrations')];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

export async function runMigrations(): Promise<{ applied: number; total: number }> {
  const log = getLogger().child({ component: 'migrate' });
  const migrationsDir = resolveMigrationsDir();

  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id           SERIAL PRIMARY KEY,
      filename     TEXT NOT NULL UNIQUE,
      checksum     TEXT NOT NULL,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const allFiles = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (allFiles.length === 0) {
    log.warn({ migrationsDir }, 'no migration files found');
    return { applied: 0, total: 0 };
  }

  const { rows: appliedRows } = await pool.query<{ filename: string; checksum: string }>(
    `SELECT filename, checksum FROM ${MIGRATIONS_TABLE}`,
  );
  const applied = new Map(appliedRows.map((r) => [r.filename, r.checksum]));

  let appliedCount = 0;
  for (const file of allFiles) {
    const fullPath = join(migrationsDir, file);
    const sql = await readFile(fullPath, 'utf-8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = applied.get(file);
    if (previous) {
      if (previous !== checksum) {
        throw new Error(
          `migration ${file} has been modified after being applied (checksum mismatch)`,
        );
      }
      continue;
    }
    log.info({ file }, 'applying migration');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum) VALUES ($1, $2)`,
        [file, checksum],
      );
      await client.query('COMMIT');
      appliedCount += 1;
      log.info({ file }, 'migration applied');
    } catch (err) {
      await client.query('ROLLBACK');
      log.error({ err, file }, 'migration failed');
      throw err;
    } finally {
      client.release();
    }
  }

  return { applied: appliedCount, total: allFiles.length };
}

async function main(): Promise<void> {
  const log = getLogger();
  try {
    const result = await runMigrations();
    log.info(result, 'migrations complete');
  } catch (err) {
    log.error({ err }, 'migration runner failed');
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

const isDirect = (() => {
  try {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    const url = new URL(`file://${argv1}`).href;
    return import.meta.url === url;
  } catch {
    return false;
  }
})();

if (isDirect) {
  void main();
}
