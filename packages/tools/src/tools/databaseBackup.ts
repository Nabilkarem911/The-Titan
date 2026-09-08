import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

function sanitizeDbName(db: string): string {
  if (!db || typeof db !== 'string') throw new Error('Invalid database name');
  if (/[;&|`$<>!]/.test(db)) throw new Error('Invalid database name: contains forbidden characters');
  const cleaned = db.replace(/[^\w]/g, '');
  if (!cleaned) throw new Error('Invalid database name');
  if (cleaned.length > 100) throw new Error('Database name too long');
  return cleaned;
}

function sanitizeOutputPath(path: string): string {
  if (path.includes('..')) throw new Error('Path traversal not allowed in output path');
  if (!path.startsWith('/tmp/') && !path.startsWith('/var/')) throw new Error('Output path must be within /tmp or /var');
  if (!path.endsWith('.sql')) throw new Error('Output path must end with .sql');
  return path;
}

export async function databaseBackup(params: { action: 'backup' | 'list' | 'info'; database?: string; outputPath?: string }): Promise<string> {
  const host = process.env['POSTGRES_HOST'] ?? 'localhost';
  const port = process.env['POSTGRES_PORT'] ?? '5432';
  const user = process.env['POSTGRES_USER'] ?? 'titan';
  const rawDb = params.database ?? process.env['POSTGRES_DB'] ?? 'titan';
  const db = sanitizeDbName(rawDb);

  switch (params.action) {
    case 'backup': {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rawOutput = params.outputPath ?? `/tmp/backup_${db}_${timestamp}.sql`;
      const output = sanitizeOutputPath(rawOutput);

      try {
        await execFileAsync('pg_dump', ['-h', host, '-p', port, '-U', user, '-d', db, '-f', output, '--no-password'], {
          env: { ...process.env, PGPASSWORD: process.env['POSTGRES_PASSWORD'] ?? '' },
          timeout: 300000,
          maxBuffer: 10 * 1024 * 1024,
        });
        return JSON.stringify({ success: true, file: output, database: db, timestamp });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Backup failed';
        return JSON.stringify({ success: false, error: message, note: 'Ensure pg_dump is available and POSTGRES_PASSWORD is set' });
      }
    }
    case 'list': {
      try {
        const files = readdirSync('/tmp').filter(f => f.startsWith('backup_') && f.endsWith('.sql'));
        const backups = files.map(f => {
          const fullPath = join('/tmp', f);
          const stat = statSync(fullPath);
          return { file: fullPath, size: stat.size, modified: stat.mtime };
        });
        return JSON.stringify({ backups });
      } catch {
        return JSON.stringify({ backups: [] });
      }
    }
    case 'info': {
      try {
        const { stdout } = await execFileAsync('psql', ['-h', host, '-p', port, '-U', user, '-d', db, '-c', 'SELECT pg_database_size(current_database())', '-t'], {
          env: { ...process.env, PGPASSWORD: process.env['POSTGRES_PASSWORD'] ?? '' },
          encoding: 'utf-8',
          timeout: 10000,
          maxBuffer: 1024 * 1024,
        });
        const size = stdout.trim();
        return JSON.stringify({ database: db, host, port, sizeBytes: parseInt(size) || 0, sizeMb: Math.round((parseInt(size) || 0) / 1024 / 1024) });
      } catch {
        return JSON.stringify({ database: db, host, port, error: 'Could not get DB info' });
      }
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
