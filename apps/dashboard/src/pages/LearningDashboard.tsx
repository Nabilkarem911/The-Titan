import { useState, useEffect } from 'react';
import { Brain, ThumbsUp, ThumbsDown, TrendingUp, Lightbulb, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';

interface Insight {
  type: string;
  description: string;
  confidence: number;
}

interface LearningData {
  positiveFeedback?: number;
  negativeFeedback?: number;
  improvementRate?: number;
  insights?: Insight[];
}

export default function LearningDashboard() {
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/learning/insights`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as LearningData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learning data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInsights(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-pink-500/20 text-pink-400">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Learning Dashboard</h3>
            <p className="text-xs text-slate-500">AI learning insights and feedback metrics</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-2"><ThumbsUp className="h-4 w-4 text-emerald-400" /> Positive Feedback</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-emerald-400">{data?.positiveFeedback ?? '—'}</div>}
            </div>
            <div className="card">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-2"><ThumbsDown className="h-4 w-4 text-red-400" /> Negative Feedback</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-red-400">{data?.negativeFeedback ?? '—'}</div>}
            </div>
            <div className="card">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-2"><TrendingUp className="h-4 w-4 text-blue-400" /> Improvement</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-white">{data?.improvementRate != null ? `${data.improvementRate}%` : '—%'}</div>}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-4 w-4 text-yellow-400" />
              <h4 className="text-sm font-medium text-white">AI Insights</h4>
            </div>
            {data?.insights && data.insights.length > 0 ? (
              <div className="space-y-3">
                {data.insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">{ins.type}</span>
                    <span className="text-sm text-slate-300">{ins.description}</span>
                    <span className="text-xs text-slate-500 ml-auto shrink-0">({Math.round(ins.confidence * 100)}%)</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Brain className="h-6 w-6 text-slate-400" />}
                title="No insights yet"
                description="Insights will appear as Titan learns from usage patterns"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
