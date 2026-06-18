import { useState, useEffect } from 'react';
import { Wrench, RefreshCw, Loader2, CheckCircle, Clock } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState } from '../components/PageState';

interface ToolUsageData {
  totalTools?: number;
  avgSuccessRate?: number;
  avgLatencyMs?: number;
  tools?: Array<{ name: string; calls: number; successRate: number; avgLatencyMs: number }>;
}

const TOOL_CATEGORIES = [
  { name: 'Execution', tools: ['execute_bash', 'docker_manage'], color: 'text-red-400' },
  { name: 'Web', tools: ['brave_search', 'http_request', 'firecrawl_scrape'], color: 'text-blue-400' },
  { name: 'Files', tools: ['read_file_content', 'write_file', 'patch_file', 'pdf_read'], color: 'text-green-400' },
  { name: 'Data', tools: ['database_query', 'calculate', 'parse_csv_json', 'excel_read'], color: 'text-yellow-400' },
  { name: 'Communication', tools: ['send_email', 'slackMessage', 'discordMessage'], color: 'text-purple-400' },
  { name: 'PM', tools: ['notionApi', 'linearApi', 'jiraApi', 'trelloApi', 'asanaApi'], color: 'text-indigo-400' },
  { name: 'Cloud', tools: ['s3Operations', 'googleDrive', 'gcsOperations', 'dropboxSync'], color: 'text-cyan-400' },
];

export default function ToolStats() {
  const [data, setData] = useState<ToolUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/tool-usage`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as ToolUsageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tool stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/20 text-orange-400">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Tool Stats</h3>
            <p className="text-xs text-slate-500">Tool usage, success rates, and latency</p>
          </div>
        </div>
        <button onClick={fetchStats} className="btn-secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchStats} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <div className="text-xs text-slate-400 mb-2">Total Tools</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-white">{data?.totalTools ?? 90}</div>}
            </div>
            <div className="card">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Avg Success Rate</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-emerald-400">{data?.avgSuccessRate != null ? `${data.avgSuccessRate}%` : '—%'}</div>}
            </div>
            <div className="card">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-2"><Clock className="h-4 w-4 text-amber-400" /> Avg Latency</div>
              {loading ? <div className="h-7 w-16 bg-slate-700/50 rounded animate-pulse" /> : <div className="text-2xl font-bold text-white">{data?.avgLatencyMs != null ? `${data.avgLatencyMs}ms` : '—ms'}</div>}
            </div>
          </div>

          {data?.tools && data.tools.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2 font-medium">Tool</th>
                    <th className="px-4 py-2 font-medium text-right">Calls</th>
                    <th className="px-4 py-2 font-medium text-right">Success</th>
                    <th className="px-4 py-2 font-medium text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {data.tools.map((t) => (
                    <tr key={t.name} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2 font-mono text-xs text-slate-300">{t.name}</td>
                      <td className="px-4 py-2 text-right text-slate-400">{t.calls}</td>
                      <td className="px-4 py-2 text-right text-emerald-400">{t.successRate}%</td>
                      <td className="px-4 py-2 text-right text-slate-400">{t.avgLatencyMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card">
            <h4 className="text-sm font-medium text-white mb-4">Tools by Category</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TOOL_CATEGORIES.map((cat) => (
                <div key={cat.name} className="p-3 rounded-lg bg-slate-800/30">
                  <div className={`text-xs font-medium ${cat.color} mb-2`}>{cat.name} ({cat.tools.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {cat.tools.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
