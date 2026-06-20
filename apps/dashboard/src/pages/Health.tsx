import { useApi } from '../hooks/useApi';
import { HeartPulse, RefreshCw } from 'lucide-react';
import type { HealthDashboard } from '../api/types';
import { ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';

export default function Health() {
  const { data, isLoading, error, refetch } = useApi<HealthDashboard>('/health/dashboard');

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-error" />
            Health
          </h1>
          <p className="text-small text-text-secondary mt-1">System health and diagnostics</p>
        </div>
        <button onClick={refetch} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* DB Pool */}
          <div className="card p-5">
            <h2 className="text-h3 text-text-primary mb-3">PostgreSQL Pool</h2>
            {data.dbPool ? (
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-h2 font-bold text-accent-primary tabular-nums">{data.dbPool.total}</p><p className="text-caption text-text-muted">Total</p></div>
                <div><p className="text-h2 font-bold text-success tabular-nums">{data.dbPool.idle}</p><p className="text-caption text-text-muted">Idle</p></div>
                <div><p className="text-h2 font-bold text-warning tabular-nums">{data.dbPool.waiting}</p><p className="text-caption text-text-muted">Waiting</p></div>
              </div>
            ) : <p className="text-small text-error">Pool unavailable</p>}
          </div>

          {/* Queues */}
          <div className="card p-5">
            <h2 className="text-h3 text-text-primary mb-3">Queues</h2>
            <pre className="text-small font-mono text-text-secondary overflow-x-auto">{JSON.stringify(data.queues, null, 2)}</pre>
          </div>

          {/* Audit */}
          <div className="card p-5">
            <h2 className="text-h3 text-text-primary mb-3">Audit Integrity</h2>
            <pre className="text-small font-mono text-text-secondary overflow-x-auto">{JSON.stringify(data.auditIntegrity, null, 2)}</pre>
          </div>

          <div className="card p-5">
            <h2 className="text-h3 text-text-primary mb-3">Audit Archival</h2>
            <pre className="text-small font-mono text-text-secondary overflow-x-auto">{JSON.stringify(data.auditArchival, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
