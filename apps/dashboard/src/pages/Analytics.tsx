import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Coins, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';

export default function Analytics() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics/tokens`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setData(await res.json() as Record<string, unknown>);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-blue-500" /> Analytics</h1>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<BarChart3 className="w-5 h-5 text-blue-400" />} label="Total Tokens" value="—" sub="Connect analytics API" />
        <StatCard icon={<Coins className="w-5 h-5 text-yellow-400" />} label="Estimated Cost" value="$0.00" sub="Last 24 hours" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-green-400" />} label="Success Rate" value="—%" sub="Agent runs" />
      </div>
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-lg font-semibold mb-4">Token Usage Over Time</h2>
        <div className="h-48 flex items-center justify-center text-zinc-500">
          {data ? <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre> : 'Connect to /api/v1/analytics/tokens for live data'}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
      <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">{icon}{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{sub}</div>
    </div>
  );
}
