import { useState } from 'react';
import { Search, Clock, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';

export default function TraceViewer() {
  const [runId, setRunId] = useState('');
  const [trace, setTrace] = useState<Record<string, unknown> | null>(null);
  const [, setLoading] = useState(false);

  const fetchTrace = async () => {
    if (!runId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics/traces/${runId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setTrace(await res.json() as Record<string, unknown>);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6 text-purple-500" /> Trace Viewer</h1>
      <div className="flex gap-2">
        <input value={runId} onChange={(e) => setRunId(e.target.value)} placeholder="Enter Run ID..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500" onKeyDown={(e) => e.key === 'Enter' && fetchTrace()} />
        <button onClick={fetchTrace} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"><Search className="w-4 h-4" /> Load Trace</button>
      </div>
      {trace ? (
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Duration: {String(trace.totalDuration ?? '—')}ms</span>
            <span>Spans: {Array.isArray(trace.spans) ? trace.spans.length : 0}</span>
          </div>
          <div className="space-y-2">
            {Array.isArray(trace.spans) && trace.spans.map((span: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-zinc-800/50 rounded-lg">
                {span.status === 'completed' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                <span className="text-sm font-medium">{String(span.name)}</span>
                <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{String(span.type)}</span>
                <span className="ml-auto text-xs text-zinc-400">{span.durationMs ? `${span.durationMs}ms` : '—'}</span>
              </div>
            ))}
          </div>
          <pre className="text-xs text-zinc-500 overflow-auto mt-4 max-h-64">{JSON.stringify(trace, null, 2)}</pre>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-xl p-12 border border-zinc-800 text-center text-zinc-500">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Enter a Run ID to view the execution trace</p>
          <p className="text-xs mt-2">Shows every LLM call, tool execution, and memory access with timing</p>
        </div>
      )}
    </div>
  );
}
