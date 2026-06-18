import { execSync } from 'node:child_process';

export async function databaseBackup(params: { action: 'backup' | 'list' | 'info'; database?: string; outputPath?: string }): Promise<string> {
  const host = process.env['POSTGRES_HOST'] ?? 'localhost';
  const port = process.env['POSTGRES_PORT'] ?? '5432';
  const user = process.env['POSTGRES_USER'] ?? 'titan';
  const db = params.database ?? process.env['POSTGRES_DB'] ?? 'titan';

  switch (params.action) {
    case 'backup': {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const output = params.outputPath ?? `/tmp/backup_${db}_${timestamp}.sql`;

      try {
        execSync(`pg_dump -h ${host} -p ${port} -U ${user} -d ${db} -f ${output} --no-password`, {
          env: { ...process.env, PGPASSWORD: process.env['POSTGRES_PASSWORD'] ?? '' },
          timeout: 300000,
        });
        return JSON.stringify({ success: true, file: output, database: db, timestamp });
      } catch (err) {
        return JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Backup failed', note: 'Ensure pg_dump is available and POSTGRES_PASSWORD is set' });
      }
    }
    case 'list': {
      try {
        const output = execSync(`ls -la /tmp/backup_*.sql 2>/dev/null || echo "No backups found"`, { encoding: 'utf-8' });
        return JSON.stringify({ backups: output.trim().split('\n').filter(Boolean) });
      } catch {
        return JSON.stringify({ backups: [] });
      }
    }
    case 'info': {
      try {
        const size = execSync(`psql -h ${host} -p ${port} -U ${user} -d ${db} -c "SELECT pg_database_size('${db}')" -t`, {
          env: { ...process.env, PGPASSWORD: process.env['POSTGRES_PASSWORD'] ?? '' },
          encoding: 'utf-8',
        }).trim();
        return JSON.stringify({ database: db, host, port, sizeBytes: parseInt(size) || 0, sizeMb: Math.round((parseInt(size) || 0) / 1024 / 1024) });
      } catch (err) {
        return JSON.stringify({ database: db, host, port, error: 'Could not get DB info' });
      }
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
