import { useState, useEffect } from 'react';
import { DollarSign, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';

interface CostData {
  today?: number;
  thisWeek?: number;
  thisMonth?: number;
  budgetStatus?: 'ok' | 'warning' | 'exceeded';
  byModel?: Array<{ model: string; cost: number; tokens: number }>;
  byTool?: Array<{ tool: string; cost: number; calls: number }>;
}

export default function CostDashboard() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCost = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/cost`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as CostData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCost(); }, []);

  const fmt = (n?: number) => n != null ? `$${n.toFixed(2)}` : '$0.00';
  const budgetColor = data?.budgetStatus === 'exceeded' ? 'text-red-400' : data?.budgetStatus === 'warning' ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Cost Dashboard</h3>
            <p className="text-xs text-slate-500">LLM and tool usage costs</p>
          </div>
        </div>
        <button onClick={fetchCost} className="btn-secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchCost} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <CostCard label="Today" value={fmt(data?.today)} loading={loading} />
            <CostCard label="This Week" value={fmt(data?.thisWeek)} loading={loading} />
            <CostCard label="This Month" value={fmt(data?.thisMonth)} loading={loading} />
            <div className="card">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Budget</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className={`text-2xl font-bold capitalize ${budgetColor}`}>{data?.budgetStatus ?? 'OK'}</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h4 className="text-sm font-medium text-white mb-4">Cost by Model</h4>
              {data?.byModel && data.byModel.length > 0 ? (
                <div className="space-y-3">
                  {data.byModel.map((m) => (
                    <div key={m.model} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{m.model}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500">{m.tokens.toLocaleString()} tokens</span>
                        <span className="text-white font-medium">${m.cost.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No model cost data" description="Costs by model will appear after agent runs" />
              )}
            </div>

            <div className="card">
              <h4 className="text-sm font-medium text-white mb-4">Cost by Tool</h4>
              {data?.byTool && data.byTool.length > 0 ? (
                <div className="space-y-3">
                  {data.byTool.map((t) => (
                    <div key={t.tool} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 font-mono text-xs">{t.tool}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500">{t.calls} calls</span>
                        <span className="text-white font-medium">${t.cost.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No tool cost data" description="Costs by tool will appear after agent runs" />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CostCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="card">
      <div className="text-xs text-slate-400 mb-2">{label}</div>
      {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-white">{value}</div>}
    </div>
  );
}
