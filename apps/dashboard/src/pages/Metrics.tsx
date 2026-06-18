import { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { getToken } from '../api/client';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function Metrics() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading((prev) => !data && prev);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch('/metrics.json', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = (await res.json()) as Record<string, unknown>;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10">
            <BarChart3 className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Metrics</h2>
            <p className="text-sm text-slate-400">System performance metrics</p>
          </div>
        </div>
        <button onClick={fetchMetrics} className="btn-secondary text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard count={6} />
        </div>
      ) : error && !data ? (
        <ErrorState message={error} onRetry={fetchMetrics} />
      ) : !data || Object.keys(data).length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6 text-slate-400" />}
          title="No metrics available"
          description="Metrics will appear once the system starts collecting data."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="card">
              <p className="text-xs text-slate-500 mb-1 truncate">{key.replace(/_/g, ' ')}</p>
              <p className="text-lg font-semibold text-white">
                {typeof value === 'number'
                  ? value.toLocaleString()
                  : typeof value === 'object'
                    ? JSON.stringify(value).slice(0, 50)
                    : String(value)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
