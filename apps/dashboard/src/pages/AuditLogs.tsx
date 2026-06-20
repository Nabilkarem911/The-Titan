import { useState } from 'react';
import { Shield } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { formatRelativeTime } from '../utils/format';
import type { AuditLog, PaginatedResponse } from '../api/client';

export default function AuditLogs() {
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, isLoading, refetch } = useApi<PaginatedResponse<AuditLog>>(
    () => api.getAuditLogs({ action: actionFilter || undefined, page, per_page: 30 }),
    [actionFilter, page]
  );

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;
  const logs = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="text" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} placeholder="Filter by action..." className="input w-56" />
        <span className="text-text-muted text-sm">{data?.total ?? 0} entries</span>
      </div>
      {logs.length === 0 ? (
        <EmptyState icon={<Shield className="w-7 h-7 text-text-muted" />} title="No audit logs" message="Activity will be recorded here" />
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>User</th><th>Action</th><th>Resource</th><th>IP Address</th><th>Time</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-text-primary">{log.username}</td>
                  <td><span className="badge badge-info text-[10px]">{log.action}</span></td>
                  <td className="text-xs font-mono text-text-secondary">{log.resource_type}/{log.resource_id.slice(0, 8)}</td>
                  <td className="text-xs font-mono text-text-muted">{log.ip_address}</td>
                  <td className="text-xs">{formatRelativeTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn btn-secondary btn-sm">Prev</button>
          <span className="text-sm text-text-muted">Page {page} of {data.total_pages}</span>
          <button onClick={() => setPage(Math.min(data.total_pages, page + 1))} disabled={page === data.total_pages} className="btn btn-secondary btn-sm">Next</button>
        </div>
      )}
    </div>
  );
}
