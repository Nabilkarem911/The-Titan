import { useState, useEffect } from 'react';
import { Brain, ThumbsUp, ThumbsDown, TrendingUp, Lightbulb, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';

export default function LearningDashboard() {
  const [insights, setInsights] = useState<Array<{ type: string; description: string; confidence: number }>>([]);
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/learning/insights`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const d = await res.json() as Record<string, unknown>; setInsights((d.insights ?? []) as typeof insights); }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchInsights(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-pink-500" /> Learning Dashboard</h1>
        <button onClick={fetchInsights} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><ThumbsUp className="w-4 h-4 text-green-400" /> Positive Feedback</div><div className="text-2xl font-bold mt-1 text-green-400">—</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><ThumbsDown className="w-4 h-4 text-red-400" /> Negative Feedback</div><div className="text-2xl font-bold mt-1 text-red-400">—</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><TrendingUp className="w-4 h-4 text-blue-400" /> Improvement</div><div className="text-2xl font-bold mt-1">—%</div></div>
      </div>
      <div className="bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="p-4 border-b border-zinc-800"><h2 className="font-semibold flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-400" /> AI Insights</h2></div>
        {insights.length > 0 ? (
          <div className="divide-y divide-zinc-800">{insights.map((ins, i) => (
            <div key={i} className="p-4"><span className="text-xs bg-zinc-800 px-2 py-0.5 rounded mr-2">{ins.type}</span><span className="text-sm">{ins.description}</span><span className="text-xs text-zinc-500 ml-2">({Math.round(ins.confidence * 100)}%)</span></div>
          ))}</div>
        ) : (
          <div className="p-12 text-center text-zinc-500"><Brain className="w-12 h-12 mx-auto mb-4 opacity-20" /><p>Insights will appear as Titan learns from usage</p></div>
        )}
      </div>
    </div>
  );
}
