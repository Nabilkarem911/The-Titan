import { useState, useEffect } from 'react';
import { AlertTriangle, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';

interface ErrorEntry {
  type: string;
  tool: string;
  message: string;
  count: number;
  lastSeen: string;
  suggestion: string;
}

export default function ErrorExplorer() {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const fetchErrors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/errors`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { errors?: ErrorEntry[] };
      setErrors(d.errors ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load errors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchErrors(); }, []);

  const filtered = filter === 'all' ? errors : errors.filter((e) => e.type === filter);
  const types = ['all', ...new Set(errors.map((e) => e.type))];

  const typeColor = (type: string) => {
    if (type === 'tool_failure') return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (type === 'timeout') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (type === 'auth_error') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Error Explorer</h3>
            <p className="text-xs text-slate-500">Analyze and diagnose recent errors</p>
          </div>
        </div>
        <button onClick={fetchErrors} className="btn-secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchErrors} />
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {types.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                  filter === f ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 border border-slate-700/30'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-24" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-6 w-6 text-slate-400" />}
              title="No errors found"
              description={filter !== 'all' ? `No ${filter.replace('_', ' ')} errors` : 'No errors recorded — everything is running smoothly'}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((err, i) => (
                <div key={i} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge border ${typeColor(err.type)}`}>{err.type.replace('_', ' ')}</span>
                        <span className="text-sm font-medium text-white">{err.tool}</span>
                      </div>
                      <p className="text-sm text-slate-400">{err.message}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-xl font-bold text-white">{err.count}</div>
                      <div className="text-xs text-slate-500">{err.lastSeen}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-400 bg-blue-500/5 border border-blue-500/10 px-3 py-2 rounded-lg">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    {err.suggestion}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
