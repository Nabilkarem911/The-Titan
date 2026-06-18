import { useState, useEffect } from 'react';
import { Wrench, RefreshCw, Loader2, CheckCircle, Clock } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';

export default function ToolStats() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics/tool-usage`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setData(await res.json() as Record<string, unknown>);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);

  const TOOL_CATEGORIES = [
    { name: 'Execution', tools: ['execute_bash', 'docker_manage'], color: 'text-red-400' },
    { name: 'Web', tools: ['brave_search', 'http_request', 'firecrawl_scrape'], color: 'text-blue-400' },
    { name: 'Files', tools: ['read_file_content', 'write_file', 'patch_file', 'pdf_read'], color: 'text-green-400' },
    { name: 'Data', tools: ['database_query', 'calculate', 'parse_csv_json', 'excel_read'], color: 'text-yellow-400' },
    { name: 'Communication', tools: ['send_email', 'slackMessage', 'discordMessage'], color: 'text-purple-400' },
    { name: 'PM', tools: ['notionApi', 'linearApi', 'jiraApi', 'trelloApi', 'asanaApi'], color: 'text-indigo-400' },
    { name: 'Cloud', tools: ['s3Operations', 'googleDrive', 'gcsOperations', 'dropboxSync'], color: 'text-cyan-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="w-6 h-6 text-orange-500" /> Tool Stats</h1>
        <button onClick={fetchStats} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm">Total Tools</div><div className="text-2xl font-bold mt-1">90</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-400" /> Avg Success Rate</div><div className="text-2xl font-bold mt-1 text-green-400">—%</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><Clock className="w-4 h-4 text-yellow-400" /> Avg Latency</div><div className="text-2xl font-bold mt-1">—ms</div></div>
      </div>
      <div className="bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="p-4 border-b border-zinc-800"><h2 className="font-semibold">Tools by Category</h2></div>
        <div className="divide-y divide-zinc-800">{TOOL_CATEGORIES.map((cat) => (
          <div key={cat.name} className="p-4">
            <div className={`font-medium ${cat.color} mb-2`}>{cat.name} ({cat.tools.length})</div>
            <div className="flex flex-wrap gap-2">{cat.tools.map((t) => (
              <span key={t} className="text-xs bg-zinc-800 px-2 py-1 rounded">{t}</span>
            ))}</div>
          </div>
        ))}</div>
      </div>
      {data && <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800"><pre className="text-xs text-zinc-400 overflow-auto">{JSON.stringify(data, null, 2)}</pre></div>}
    </div>
  );
}
