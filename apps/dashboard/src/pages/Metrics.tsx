import { useState, useEffect } from 'react';
import { RefreshCw, Loader2, Activity, Clock, Zap, BarChart3 } from 'lucide-react';

interface MetricValue {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

interface MetricsJson {
  metrics: Record<string, unknown>;
  dbPool: { total: number; idle: number; waiting: number } | null;
  redis: { status: string; memory?: number };
  timestamp: string;
}

export default function Metrics() {
  const [data, setData] = useState<MetricsJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/metrics.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as MetricsJson;
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10_000);
    return () => clearInterval(interval);
  }, []);

  const extractCounters = (metrics: Record<string, unknown>): MetricValue[] => {
    const out: MetricValue[] = [];
    for (const [key, val] of Object.entries(metrics)) {
      if (typeof val === 'number') {
        out.push({ name: key, value: val });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  };

  const counters = data ? extractCounters(data.metrics) : [];

  const agentRuns = counters.filter((c) => c.name.includes('agent_runs_total'));
  const llmReqs = counters.filter((c) => c.name.includes('llm_requests_total'));
  const llmTokens = counters.filter((c) => c.name.includes('llm_tokens_total'));
  const sandboxStats = counters.filter((c) => c.name.includes('sandbox'));
  const otherCounters = counters.filter(
    (c) => !c.name.includes('agent_runs') && !c.name.includes('llm_') && !c.name.includes('sandbox'),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Metrics</h1>
          <p className="text-slate-400 mt-1">
            Real-time Prometheus-compatible metrics from the core API.
            {lastUpdated && ` Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={fetchMetrics} className="btn-secondary" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Infra cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-semibold text-white">PostgreSQL</span>
          </div>
          {data?.dbPool ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="text-white">{data.dbPool.total}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Idle</span><span className="text-emerald-400">{data.dbPool.idle}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Waiting</span><span className="text-amber-400">{data.dbPool.waiting}</span></div>
            </div>
          ) : (
            <span className="text-sm text-slate-500">No pool info</span>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-semibold text-white">Redis</span>
          </div>
          {data?.redis ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Status</span>
                <span className={data.redis.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{data.redis.status}</span>
              </div>
              {data.redis.memory !== undefined && (
                <div className="flex justify-between"><span className="text-slate-500">Memory</span><span className="text-white">{(data.redis.memory / 1024 / 1024).toFixed(1)} MB</span></div>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-500">No redis info</span>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Timestamp</span>
          </div>
          <div className="text-sm text-slate-300">
            {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '—'}
          </div>
        </div>
      </div>

      {/* Agent runs */}
      {agentRuns.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Agent Runs</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {agentRuns.map((m) => (
              <div key={m.name} className="rounded-lg bg-slate-800/50 p-3">
                <div className="text-xs text-slate-500 mb-1">{m.name.replace(/[{}]/g, '')}</div>
                <div className="text-xl font-bold text-white">{m.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LLM */}
      {llmReqs.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">LLM Provider</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {llmReqs.map((m) => (
              <div key={m.name} className="rounded-lg bg-slate-800/50 p-3">
                <div className="text-xs text-slate-500 mb-1">{m.name.replace(/[{}]/g, '')}</div>
                <div className="text-xl font-bold text-white">{m.value.toLocaleString()}</div>
              </div>
            ))}
            {llmTokens.map((m) => (
              <div key={m.name} className="rounded-lg bg-slate-800/50 p-3">
                <div className="text-xs text-slate-500 mb-1">{m.name.replace(/[{}]/g, '')}</div>
                <div className="text-xl font-bold text-white">{m.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sandbox */}
      {sandboxStats.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Sandbox</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sandboxStats.map((m) => (
              <div key={m.name} className="rounded-lg bg-slate-800/50 p-3">
                <div className="text-xs text-slate-500 mb-1">{m.name.replace(/[{}]/g, '')}</div>
                <div className="text-xl font-bold text-white">{m.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other metrics */}
      {otherCounters.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Other Metrics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {otherCounters.map((m) => (
              <div key={m.name} className="rounded-lg bg-slate-800/50 p-3">
                <div className="text-xs text-slate-500 mb-1 truncate">{m.name.replace(/[{}]/g, '')}</div>
                <div className="text-xl font-bold text-white">{m.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="card text-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading metrics...
        </div>
      )}
    </div>
  );
}
