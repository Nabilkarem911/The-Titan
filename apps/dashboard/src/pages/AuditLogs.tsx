import { useState } from 'react';
import { ShieldCheck, Search } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { ListResponse, AuditLog } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonRow } from '../components/LoadingSkeleton';
import { useDebounce } from '../hooks/useDebounce';
import { formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading, error, refetch } = useApi<ListResponse<AuditLog>>(
    debouncedSearch ? `/compliance/audit/logs?limit=50&action=${encodeURIComponent(debouncedSearch)}` : '/compliance/audit/logs?limit=50',
  );

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        icon={ShieldCheck}
        title="Audit Logs"
        subtitle="Immutable record of all system actions"
        description="Audit Logs are an immutable, tamper-evident record of every action taken in Titan — who did what, when, and from where. They're critical for compliance, security investigations, and debugging. Logs cannot be deleted or modified. Use this page to search and browse all system activity."
        tips={[
          'Use the search box to filter logs by action type',
          'Each log shows: action, resource, actor, IP address, and timestamp',
          'Logs are immutable — they can never be deleted or modified',
        ]}
        accent="text-success"
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit logs..." className="input pl-9" />
      </div>

      {isLoading ? (
        <div className="card">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} columns={3} />)}</div>
      ) : data?.items.length ? (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {data.items.map((log) => (
              <div key={log.id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-accent-primary/10 text-accent-primary">{log.action}</span>
                    <span className="text-small text-text-secondary">{log.resource}</span>
                  </div>
                  <span className="text-caption text-text-muted">{formatDate(log.createdAt)}</span>
                </div>
                <div className="flex items-center gap-4 text-caption text-text-muted">
                  <span>Actor: <span className="font-mono text-text-secondary">{log.actorId?.slice(0, 8) ?? 'system'}</span></span>
                  <span>IP: <span className="font-mono text-text-secondary">{log.ipAddress ?? '—'}</span></span>
                  {log.resourceId && <span>Resource: <span className="font-mono text-text-secondary">{log.resourceId.slice(0, 8)}</span></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={ShieldCheck} title="No audit logs" description={search ? "Try a different search" : "Audit logs will appear here as actions are performed"} />
      )}
    </div>
  );
}
