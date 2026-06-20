import { useApi } from '../hooks/useApi';
import { BarChart3 } from 'lucide-react';
import type { MetricsSnapshot } from '../api/types';
import { ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';

export default function Metrics() {
  const { data, isLoading, error, refetch } = useApi<MetricsSnapshot>('/metrics.json');

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-h1 text-text-primary flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-accent-primary" />
          Metrics
        </h1>
        <p className="text-small text-text-secondary mt-1">System metrics and performance data</p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5">
              <h3 className="text-h3 text-text-primary mb-2">Redis</h3>
              <p className="text-h2 font-bold text-accent-primary">{data.redis.status}</p>
              {data.redis.memory && <p className="text-small text-text-muted mt-1">{(data.redis.memory / 1024 / 1024).toFixed(1)} MB used</p>}
            </div>
            <div className="card p-5">
              <h3 className="text-h3 text-text-primary mb-2">DB Pool</h3>
              {data.dbPool ? (
                <div className="space-y-1">
                  <p className="text-small text-text-secondary">Total: <span className="text-text-primary tabular-nums">{data.dbPool.total}</span></p>
                  <p className="text-small text-text-secondary">Idle: <span className="text-success tabular-nums">{data.dbPool.idle}</span></p>
                  <p className="text-small text-text-secondary">Waiting: <span className="text-warning tabular-nums">{data.dbPool.waiting}</span></p>
                </div>
              ) : <p className="text-small text-error">Unavailable</p>}
            </div>
            <div className="card p-5">
              <h3 className="text-h3 text-text-primary mb-2">Timestamp</h3>
              <p className="text-small text-text-secondary">{new Date(data.timestamp).toLocaleString()}</p>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-h3 text-text-primary mb-3">All Metrics</h2>
            <pre className="text-small font-mono text-text-secondary overflow-x-auto max-h-96">{JSON.stringify(data.metrics, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
