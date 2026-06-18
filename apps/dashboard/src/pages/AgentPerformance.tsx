import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';

export default function AgentPerformance() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPerf = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics/agent-performance`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setData(await res.json() as Record<string, unknown>);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchPerf(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6 text-cyan-500" /> Agent Performance</h1>
        <button onClick={fetchPerf} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-400" /> Success Rate</div><div className="text-2xl font-bold mt-1 text-green-400">—%</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><XCircle className="w-4 h-4 text-red-400" /> Failure Rate</div><div className="text-2xl font-bold mt-1 text-red-400">—%</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><Clock className="w-4 h-4 text-yellow-400" /> Avg Latency</div><div className="text-2xl font-bold mt-1">—ms</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm">Total Runs</div><div className="text-2xl font-bold mt-1">—</div></div>
      </div>
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-lg font-semibold mb-4">Performance by Agent Profile</h2>
        <div className="h-48 flex items-center justify-center text-zinc-500">{data ? <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre> : 'Connect analytics API for per-agent performance data'}</div>
      </div>
    </div>
  );
}
