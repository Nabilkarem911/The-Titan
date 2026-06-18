import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Coins, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';

interface AnalyticsData {
  totalTokens?: number;
  totalCost?: number;
  successRate?: number;
  dailyUsage?: Array<{ date: string; tokens: number; cost: number }>;
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/tokens`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as AnalyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 text-blue-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Analytics</h3>
            <p className="text-xs text-slate-500">Token usage and cost analysis</p>
          </div>
        </div>
        <button onClick={fetchData} className="btn-secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={<BarChart3 className="h-5 w-5 text-blue-400" />} label="Total Tokens" value={data?.totalTokens?.toLocaleString() ?? '—'} sub="All time" loading={loading} />
            <StatCard icon={<Coins className="h-5 w-5 text-yellow-400" />} label="Estimated Cost" value={data?.totalCost != null ? `$${data.totalCost.toFixed(2)}` : '$0.00'} sub="Last 24 hours" loading={loading} />
            <StatCard icon={<TrendingUp className="h-5 w-5 text-green-400" />} label="Success Rate" value={data?.successRate != null ? `${data.successRate}%` : '—%'} sub="Agent runs" loading={loading} />
          </div>

          <div className="card">
            <h4 className="text-sm font-medium text-white mb-4">Token Usage Over Time</h4>
            {data?.dailyUsage && data.dailyUsage.length > 0 ? (
              <div className="space-y-2">
                {data.dailyUsage.map((day) => (
                  <div key={day.date} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-500 w-24">{day.date}</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (day.tokens / (data.totalTokens || 1)) * 100 * data.dailyUsage!.length)}%` }} />
                    </div>
                    <span className="text-slate-400 w-20 text-right">{day.tokens.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No usage data yet" description="Token usage will appear here as agents run" />
            )}
          </div>

          {data && !data.dailyUsage && (
            <div className="card">
              <h4 className="text-sm font-medium text-white mb-3">Raw Data</h4>
              <pre className="text-xs text-slate-400 overflow-auto max-h-48">{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, loading }: { icon: React.ReactNode; label: string; value: string; sub: string; loading: boolean }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">{icon}<span>{label}</span></div>
      {loading ? (
        <div className="h-7 w-20 bg-slate-700/50 rounded animate-pulse" />
      ) : (
        <div className="text-2xl font-bold text-white">{value}</div>
      )}
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}
