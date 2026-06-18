import { useState, useEffect } from 'react';
import { PieChart, Users, HardDrive, DollarSign, Activity, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';

interface InsightsData {
  members?: number;
  activeToday?: number;
  storageUsedMb?: number;
  monthlyCost?: number;
  topAgents?: Array<{ name: string; runs: number }>;
  topTools?: Array<{ name: string; calls: number }>;
}

export default function WorkspaceInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/workspace`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as InsightsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInsights(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-500/20 text-teal-400">
            <PieChart className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Workspace Insights</h3>
            <p className="text-xs text-slate-500">Overview of workspace activity and usage</p>
          </div>
        </div>
        <button onClick={fetchInsights} className="btn-secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchInsights} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={<Users className="h-5 w-5 text-blue-400" />} label="Members" value={data?.members ?? '—'} loading={loading} />
            <StatCard icon={<Activity className="h-5 w-5 text-emerald-400" />} label="Active Today" value={data?.activeToday ?? '—'} loading={loading} />
            <StatCard icon={<HardDrive className="h-5 w-5 text-purple-400" />} label="Storage Used" value={data?.storageUsedMb != null ? `${data.storageUsedMb}MB` : '—MB'} loading={loading} />
            <StatCard icon={<DollarSign className="h-5 w-5 text-yellow-400" />} label="Monthly Cost" value={data?.monthlyCost != null ? `$${data.monthlyCost.toFixed(2)}` : '$—'} loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h4 className="text-sm font-medium text-white mb-4">Top Agents This Week</h4>
              {data?.topAgents && data.topAgents.length > 0 ? (
                <div className="space-y-3">
                  {data.topAgents.map((agent, i) => (
                    <div key={agent.name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300"><span className="text-slate-500 mr-2">{i + 1}.</span>{agent.name}</span>
                      <span className="text-slate-400">{agent.runs} runs</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No agent activity yet" description="Run some agents to see top performers" />
              )}
            </div>

            <div className="card">
              <h4 className="text-sm font-medium text-white mb-4">Top Tools This Week</h4>
              {data?.topTools && data.topTools.length > 0 ? (
                <div className="space-y-3">
                  {data.topTools.map((tool, i) => (
                    <div key={tool.name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 font-mono text-xs"><span className="text-slate-500 mr-2 font-sans">{i + 1}.</span>{tool.name}</span>
                      <span className="text-slate-400">{tool.calls} calls</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No tool activity yet" description="Tool usage stats will appear here" />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: string | number; loading: boolean }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">{icon}<span>{label}</span></div>
      {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-white">{value}</div>}
    </div>
  );
}
