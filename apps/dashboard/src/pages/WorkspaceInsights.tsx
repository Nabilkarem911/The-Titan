import { Users, BarChart3, HardDrive, Coins, Activity } from 'lucide-react';

export default function WorkspaceInsights() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-teal-500" /> Workspace Insights</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><Users className="w-4 h-4" /> Members</div><div className="text-2xl font-bold mt-1">—</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><Activity className="w-4 h-4" /> Active Today</div><div className="text-2xl font-bold mt-1">—</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><HardDrive className="w-4 h-4" /> Storage Used</div><div className="text-2xl font-bold mt-1">—MB</div></div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"><div className="text-zinc-400 text-sm flex items-center gap-1"><Coins className="w-4 h-4" /> Monthly Cost</div><div className="text-2xl font-bold mt-1">$—</div></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">Top Agents This Week</h2>
          <div className="space-y-3">
            {['General Assistant', 'Code Helper', 'Web Researcher'].map((agent, i) => (
              <div key={agent} className="flex items-center justify-between"><span className="text-sm">{i + 1}. {agent}</span><span className="text-xs text-zinc-500">— runs</span></div>
            ))}
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">Top Tools This Week</h2>
          <div className="space-y-3">
            {['brave_search', 'execute_bash', 'http_request'].map((tool, i) => (
              <div key={tool} className="flex items-center justify-between"><span className="text-sm font-mono">{i + 1}. {tool}</span><span className="text-xs text-zinc-500">— calls</span></div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="h-32 flex items-center justify-center text-zinc-500">Connect to workspace activity API for real-time feed</div>
      </div>
    </div>
  );
}
