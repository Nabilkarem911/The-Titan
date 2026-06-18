import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';

interface PerfData {
  successRate?: number;
  failureRate?: number;
  avgLatencyMs?: number;
  totalRuns?: number;
  agents?: Array<{ name: string; runs: number; successRate: number; avgLatencyMs: number }>;
}

export default function AgentPerformance() {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerf = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/agent-performance`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as PerfData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPerf(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Agent Performance</h3>
            <p className="text-xs text-slate-500">Success rates, latency, and run statistics</p>
          </div>
        </div>
        <button onClick={fetchPerf} className="btn-secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchPerf} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Success Rate</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-emerald-400">{data?.successRate != null ? `${data.successRate}%` : '—%'}</div>}
            </div>
            <div className="card">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-2"><XCircle className="h-4 w-4 text-red-400" /> Failure Rate</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-red-400">{data?.failureRate != null ? `${data.failureRate}%` : '—%'}</div>}
            </div>
            <div className="card">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-2"><Clock className="h-4 w-4 text-amber-400" /> Avg Latency</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-white">{data?.avgLatencyMs != null ? `${data.avgLatencyMs}ms` : '—ms'}</div>}
            </div>
            <div className="card">
              <div className="text-xs text-slate-400 mb-2">Total Runs</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-white">{data?.totalRuns?.toLocaleString() ?? '—'}</div>}
            </div>
          </div>

          <div className="card">
            <h4 className="text-sm font-medium text-white mb-4">Performance by Agent Profile</h4>
            {data?.agents && data.agents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2 font-medium">Agent</th>
                      <th className="px-4 py-2 font-medium text-right">Runs</th>
                      <th className="px-4 py-2 font-medium text-right">Success</th>
                      <th className="px-4 py-2 font-medium text-right">Avg Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {data.agents.map((agent) => (
                      <tr key={agent.name} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2 text-slate-200">{agent.name}</td>
                        <td className="px-4 py-2 text-right text-slate-400">{agent.runs}</td>
                        <td className="px-4 py-2 text-right text-emerald-400">{agent.successRate}%</td>
                        <td className="px-4 py-2 text-right text-slate-400">{agent.avgLatencyMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No performance data yet" description="Run some agents to see performance metrics" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
