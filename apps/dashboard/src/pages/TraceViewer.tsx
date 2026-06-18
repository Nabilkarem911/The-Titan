import { useState } from 'react';
import { Search, Clock, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState } from '../components/PageState';

interface Span {
  name: string;
  type: string;
  status: string;
  durationMs?: number;
}

interface TraceData {
  totalDuration?: number;
  spans?: Span[];
  [key: string]: unknown;
}

export default function TraceViewer() {
  const [runId, setRunId] = useState('');
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrace = async () => {
    if (!runId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/traces/${runId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Trace not found`);
      setTrace(await res.json() as TraceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/20 text-purple-400">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Trace Viewer</h3>
          <p className="text-xs text-slate-500">Inspect execution traces for any run</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={runId}
          onChange={(e) => setRunId(e.target.value)}
          placeholder="Enter Run ID..."
          className="input flex-1"
          onKeyDown={(e) => e.key === 'Enter' && fetchTrace()}
        />
        <button onClick={fetchTrace} disabled={loading || !runId.trim()} className="btn-primary">
          <Search className="h-4 w-4" />
          {loading ? 'Loading...' : 'Load Trace'}
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={fetchTrace} />}

      {trace ? (
        <div className="card space-y-4">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> Duration: {trace.totalDuration ?? '—'}ms</span>
            <span>Spans: {trace.spans?.length ?? 0}</span>
          </div>
          {trace.spans && trace.spans.length > 0 && (
            <div className="space-y-2">
              {trace.spans.map((span, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50">
                  {span.status === 'completed' ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-red-400" />}
                  <span className="text-sm font-medium text-slate-200">{span.name}</span>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{span.type}</span>
                  <span className="ml-auto text-xs text-slate-400">{span.durationMs ? `${span.durationMs}ms` : '—'}</span>
                </div>
              ))}
            </div>
          )}
          <details className="text-xs">
            <summary className="text-slate-500 cursor-pointer hover:text-slate-300">Raw JSON</summary>
            <pre className="text-slate-400 overflow-auto mt-2 max-h-64 p-3 rounded-lg bg-slate-800/30">{JSON.stringify(trace, null, 2)}</pre>
          </details>
        </div>
      ) : !error && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Zap className="h-12 w-12 text-slate-700 mb-4" />
          <p className="text-sm text-slate-400">Enter a Run ID to view the execution trace</p>
          <p className="text-xs text-slate-600 mt-1">Shows every LLM call, tool execution, and memory access with timing</p>
        </div>
      )}
    </div>
  );
}
