import { useState, useEffect, useCallback } from 'react';
import { HeartPulse, RefreshCw } from 'lucide-react';
import { getToken } from '../api/client';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/PageState';

interface HealthData {
  status: string;
  uptime?: number;
  db?: { status: string; latency?: number };
  redis?: { status: string; latency?: number };
  memory?: { rss?: number; heapUsed?: number; heapTotal?: number };
  [key: string]: unknown;
}

export default function Health() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading((prev) => !data && prev);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch('/health/dashboard', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = (await res.json()) as HealthData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10">
            <HeartPulse className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">System Health</h2>
            <p className="text-sm text-slate-400">Monitor service health and uptime</p>
          </div>
        </div>
        <button onClick={fetchHealth} className="btn-secondary text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard count={3} />
        </div>
      ) : error && !data ? (
        <ErrorState message={error} onRetry={fetchHealth} />
      ) : data ? (
        <>
          {/* Overall status */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-3 h-3 rounded-full ${
                data.status === 'ok' || data.status === 'healthy' ? 'bg-emerald-400' : 'bg-red-400'
              }`} />
              <span className="text-white font-medium">
                System is {data.status === 'ok' || data.status === 'healthy' ? 'healthy' : data.status}
              </span>
            </div>
            {data.uptime !== undefined && (
              <p className="text-sm text-slate-400">
                Uptime: {Math.floor(data.uptime / 3600)}h {Math.floor((data.uptime % 3600) / 60)}m
              </p>
            )}
          </div>

          {/* Service cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ServiceCard
              name="Database"
              status={data.db?.status ?? 'unknown'}
              latency={data.db?.latency}
            />
            <ServiceCard
              name="Redis"
              status={data.redis?.status ?? 'unknown'}
              latency={data.redis?.latency}
            />
            <ServiceCard
              name="API"
              status={data.status}
            />
          </div>

          {/* Memory */}
          {data.memory && (
            <div className="card">
              <h3 className="text-sm font-medium text-white mb-3">Memory Usage</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">RSS</p>
                  <p className="text-white">{formatMB(data.memory.rss)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Heap Used</p>
                  <p className="text-white">{formatMB(data.memory.heapUsed)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Heap Total</p>
                  <p className="text-white">{formatMB(data.memory.heapTotal)}</p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function ServiceCard({ name, status, latency }: { name: string; status: string; latency?: number }) {
  const isOk = status === 'ok' || status === 'healthy';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-300">{name}</span>
        <span className={`badge ${isOk ? 'badge-success' : 'badge-error'}`}>{status}</span>
      </div>
      {latency !== undefined && (
        <p className="text-xs text-slate-500">{latency}ms latency</p>
      )}
    </div>
  );
}

function formatMB(bytes?: number): string {
  if (bytes === undefined) return '--';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
