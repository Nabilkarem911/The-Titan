import { Gauge, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { usePollingApi } from '../hooks/useApi';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/PageState';

export default function Queue() {
  const { data, loading, error, refetch } = usePollingApi(
    () => api.getQueueStats('agent-runs'),
    10_000,
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/10">
            <Gauge className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Queue</h2>
            <p className="text-sm text-slate-400">Monitor job queue status</p>
          </div>
        </div>
        <button onClick={refetch} className="btn-secondary text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <SkeletonCard count={5} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <QueueCard label="Waiting" value={data.waiting} color="text-amber-400" />
          <QueueCard label="Active" value={data.active} color="text-blue-400" />
          <QueueCard label="Completed" value={data.completed} color="text-emerald-400" />
          <QueueCard label="Failed" value={data.failed} color="text-red-400" />
          <QueueCard label="Delayed" value={data.delayed} color="text-slate-400" />
        </div>
      ) : null}
    </div>
  );
}

function QueueCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}
