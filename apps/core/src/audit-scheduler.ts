import { getLogger } from '@titan/logging';
import { loadConfig } from '@titan/config';
import { verifyHashChain, archiveOlderThan } from '@titan/database';
import { setGauge, incCounter } from '@titan/observability';

const log = getLogger().child({ component: 'audit-scheduler' });

let verifyTimer: NodeJS.Timeout | null = null;
let archiveTimer: NodeJS.Timeout | null = null;
let lastVerifyResult: { valid: boolean; brokenAt: string | null; checked: number; ts: number } | null = null;
let lastArchiveResult: { archived: number; ts: number } | null = null;

export function getLastVerifyResult(): typeof lastVerifyResult {
  return lastVerifyResult;
}

export function getLastArchiveResult(): typeof lastArchiveResult {
  return lastArchiveResult;
}

export function startAuditSchedulers(): void {
  const cfg = loadConfig();
  verifyTimer = setInterval(() => {
    void (async () => {
      try {
        const r = await verifyHashChain(1000);
        lastVerifyResult = { ...r, ts: Date.now() };
        setGauge('audit_hash_chain_checked', 'Last hash chain verification count', r.checked);
        if (r.valid) {
          incCounter('audit_hash_chain_verify_ok_total', 'Successful hash chain verifications', 1);
        } else {
          incCounter('audit_hash_chain_violations_total', 'Audit hash chain violations', 1);
          log.fatal({ brokenAt: r.brokenAt, checked: r.checked }, 'audit hash chain BROKEN');
        }
      } catch (err) {
        log.error({ err }, 'hash chain verify failed');
        incCounter('audit_hash_chain_verify_error_total', 'Hash chain verify errors', 1);
      }
    })();
  }, cfg.AUDIT_VERIFY_INTERVAL_MS);
  if (verifyTimer.unref) verifyTimer.unref();

  archiveTimer = setInterval(() => {
    void (async () => {
      try {
        const r = await archiveOlderThan(cfg.AUDIT_RETENTION_DAYS, cfg.AUDIT_ARCHIVE_BATCH_SIZE);
        if (r.archived > 0) {
          lastArchiveResult = { archived: r.archived, ts: Date.now() };
          log.info({ archived: r.archived, daysOld: cfg.AUDIT_RETENTION_DAYS }, 'audit archived');
        }
      } catch (err) {
        log.error({ err }, 'audit archive failed');
      }
    })();
  }, 3_600_000);
  if (archiveTimer.unref) archiveTimer.unref();

  log.info(
    { verifyEveryMs: cfg.AUDIT_VERIFY_INTERVAL_MS, archiveEveryMs: 3_600_000, retentionDays: cfg.AUDIT_RETENTION_DAYS },
    'audit schedulers started',
  );
}

export function stopAuditSchedulers(): void {
  if (verifyTimer) { clearInterval(verifyTimer); verifyTimer = null; }
  if (archiveTimer) { clearInterval(archiveTimer); archiveTimer = null; }
}
