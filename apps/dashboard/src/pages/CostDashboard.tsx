import { useState, useEffect } from 'react';
import { Coins, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';

export default function CostDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCost = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics/cost`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setData(await res.json() as Record<string, unknown>);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchCost(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Coins className="w-6 h-6 text-yellow-500" /> Cost Dashboard</h1>
        <button onClick={fetchCost} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><Coins className="w-4 h-4" /> Today</div><div className="text-2xl font-bold mt-1">$0.00</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm">This Week</div><div className="text-2xl font-bold mt-1">$0.00</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm">This Month</div><div className="text-2xl font-bold mt-1">$0.00</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-yellow-400" /> Budget Alert</div><div className="text-2xl font-bold mt-1 text-green-400">OK</div></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800"><h2 className="text-lg font-semibold mb-4">Cost by Model</h2><div className="h-40 flex items-center justify-center text-zinc-500">Connect to analytics API for model breakdown</div></div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800"><h2 className="text-lg font-semibold mb-4">Cost by Tool</h2><div className="h-40 flex items-center justify-center text-zinc-500">Connect to analytics API for tool cost data</div></div>
      </div>
      {data && <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800"><h2 className="text-lg font-semibold mb-2">Raw Data</h2><pre className="text-xs text-zinc-400 overflow-auto">{JSON.stringify(data, null, 2)}</pre></div>}
    </div>
  );
}
