import { useState } from 'react';
import { Clock, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { usePollingApi, useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames, formatRelativeTime } from '../utils/format';
import type { QueueStats, QueueJob } from '../api/client';

const statusBadge: Record<string, string> = { pending: 'badge-warning', running: 'badge-info', completed: 'badge-success', failed: 'badge-error' };

export default function Queue() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: stats, isLoading: statsLoading } = usePollingApi<QueueStats>(() => api.getQueueStats(), 5000, []);
  const { data: jobs, error, isLoading: jobsLoading, refetch } = useApi<QueueJob[]>(() => api.getQueueJobs(statusFilter || undefined), [statusFilter]);

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (statsLoading && jobsLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Pending', value: stats.pending, color: 'text-warning' },
            { label: 'Running', value: stats.running, color: 'text-cyan' },
            { label: 'Completed', value: stats.completed, color: 'text-success' },
            { label: 'Failed', value: stats.failed, color: 'text-pink' },
            { label: 'Workers', value: stats.workers, color: 'text-violet' },
            { label: 'Throughput', value: `${stats.throughput}/s`, color: 'text-text-primary' },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <div className={classNames('text-xl font-heading font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-44">
          <option value="">All Statuses</option><option value="pending">Pending</option><option value="running">Running</option><option value="completed">Completed</option><option value="failed">Failed</option>
        </select>
        <button onClick={refetch} className="btn btn-secondary btn-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      {!jobs || jobs.length === 0 ? (
        <EmptyState icon={<Clock className="w-7 h-7 text-text-muted" />} title="No jobs in queue" message="Queue jobs will appear here when created" />
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Job ID</th><th>Agent</th><th>Status</th><th>Priority</th><th>Retries</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="font-mono text-xs">{job.id.slice(0, 8)}</td>
                  <td className="text-text-primary">{job.agent_name || job.agent_id.slice(0, 8)}</td>
                  <td><span className={classNames('badge', statusBadge[job.status] || 'badge-neutral')}>{job.status}</span></td>
                  <td className="font-mono text-xs">{job.priority}</td>
                  <td className="text-xs">{job.retries}/{job.max_retries}</td>
                  <td className="text-xs">{formatRelativeTime(job.created_at)}</td>
                  <td>
                    <div className="flex gap-1">
                      {job.status === 'failed' && <button onClick={async () => { await api.retryJob(job.id); refetch(); }} className="btn btn-ghost p-1 text-cyan"><RotateCcw className="w-3.5 h-3.5" /></button>}
                      {(job.status === 'pending' || job.status === 'running') && <button onClick={async () => { await api.cancelJob(job.id); refetch(); }} className="btn btn-ghost p-1 text-text-muted hover:text-pink"><XCircle className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
