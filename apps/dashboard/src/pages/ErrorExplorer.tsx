import { useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

const SAMPLE_ERRORS = [
  { type: 'tool_failure', tool: 'brave_search', message: 'Rate limit exceeded', count: 12, lastSeen: '2 hours ago', suggestion: 'Increase rate limit or use alternative search tool' },
  { type: 'timeout', tool: 'http_request', message: 'ETIMEDOUT after 30s', count: 5, lastSeen: '1 hour ago', suggestion: 'Increase timeout or check target server health' },
  { type: 'auth_error', tool: 'github_api', message: '401 Unauthorized', count: 3, lastSeen: '30 min ago', suggestion: 'Refresh GitHub token in integrations' },
  { type: 'llm_error', tool: 'agent_run', message: 'Context window exceeded', count: 2, lastSeen: '4 hours ago', suggestion: 'Enable smart context selection or reduce max steps' },
];

export default function ErrorExplorer() {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? SAMPLE_ERRORS : SAMPLE_ERRORS.filter((e) => e.type === filter);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-red-500" /> Error Explorer</h1>
      <div className="flex gap-2">
        {['all', 'tool_failure', 'timeout', 'auth_error', 'llm_error'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filter === f ? 'bg-red-600' : 'bg-zinc-800 hover:bg-zinc-700'}`}>{f.replace('_', ' ')}</button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((err, i) => (
          <div key={i} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1"><span className={`text-xs px-2 py-0.5 rounded ${err.type === 'tool_failure' ? 'bg-red-900 text-red-300' : err.type === 'timeout' ? 'bg-yellow-900 text-yellow-300' : 'bg-orange-900 text-orange-300'}`}>{err.type}</span><span className="text-sm font-medium">{err.tool}</span></div>
                <p className="text-sm text-zinc-400">{err.message}</p>
              </div>
              <div className="text-right"><div className="text-xl font-bold">{err.count}</div><div className="text-xs text-zinc-500">{err.lastSeen}</div></div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-400 bg-blue-950/30 px-3 py-2 rounded"><ArrowRight className="w-3 h-3" /> {err.suggestion}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
