import { useState } from 'react';
import { ListOrdered, Eye, XCircle } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames, formatRelativeTime, formatDuration, truncate } from '../utils/format';
import type { ApiRun, PaginatedResponse } from '../api/client';

const statusBadge: Record<string, string> = {
  queued: 'badge-neutral', running: 'badge-info', completed: 'badge-success', failed: 'badge-error', cancelled: 'badge-warning',
};

export default function Runs() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<ApiRun | null>(null);

  const { data, error, isLoading, refetch } = useApi<PaginatedResponse<ApiRun>>(
    () => api.getRuns({ status: statusFilter || undefined, page, per_page: 20 }),
    [statusFilter, page]
  );

  const cancelRun = async (id: string) => { await api.cancelRun(id); refetch(); };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  const runs = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-44">
          <option value="">All Statuses</option>
          <option value="queued">Queued</option><option value="running">Running</option>
          <option value="completed">Completed</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option>
        </select>
        <span className="text-text-muted text-sm">{data?.total ?? 0} total runs</span>
      </div>

      {runs.length === 0 ? (
        <EmptyState icon={<ListOrdered className="w-7 h-7 text-text-muted" />} title="No runs found" message="Agent runs will appear here" />
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Run ID</th><th>Agent</th><th>Status</th><th>Input</th><th>Duration</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="font-mono text-xs">{run.id.slice(0, 8)}</td>
                  <td className="text-text-primary">{run.agent_name || run.agent_id.slice(0, 8)}</td>
                  <td><span className={classNames('badge', statusBadge[run.status] || 'badge-neutral')}>{run.status}</span></td>
                  <td className="text-xs max-w-[200px] truncate">{truncate(run.input, 50)}</td>
                  <td className="font-mono text-xs">{run.duration_ms ? formatDuration(run.duration_ms) : '--'}</td>
                  <td className="text-xs">{formatRelativeTime(run.created_at)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedRun(run)} className="btn btn-ghost p-1"><Eye className="w-3.5 h-3.5" /></button>
                      {(run.status === 'queued' || run.status === 'running') && (
                        <button onClick={() => cancelRun(run.id)} className="btn btn-ghost p-1 text-text-muted hover:text-pink"><XCircle className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </td>
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

      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRun(null)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-text-primary">Run Details</h2>
              <button onClick={() => setSelectedRun(null)} className="btn btn-ghost p-1"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-text-muted">ID:</span> <span className="font-mono text-text-primary">{selectedRun.id}</span></div>
              <div><span className="text-text-muted">Status:</span> <span className={classNames('badge ms-2', statusBadge[selectedRun.status])}>{selectedRun.status}</span></div>
              <div><span className="text-text-muted">Input:</span><pre className="mt-1 p-3 bg-deep rounded-lg text-text-secondary text-xs font-mono whitespace-pre-wrap">{selectedRun.input}</pre></div>
              {selectedRun.output && <div><span className="text-text-muted">Output:</span><pre className="mt-1 p-3 bg-deep rounded-lg text-text-secondary text-xs font-mono whitespace-pre-wrap">{selectedRun.output}</pre></div>}
              {selectedRun.error && <div><span className="text-text-muted">Error:</span><pre className="mt-1 p-3 bg-[rgba(255,0,122,0.05)] rounded-lg text-pink text-xs font-mono whitespace-pre-wrap">{selectedRun.error}</pre></div>}
              <div className="flex gap-6 text-xs text-text-muted">
                {selectedRun.tokens_used && <span>Tokens: {selectedRun.tokens_used.toLocaleString()}</span>}
                {selectedRun.duration_ms && <span>Duration: {formatDuration(selectedRun.duration_ms)}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
