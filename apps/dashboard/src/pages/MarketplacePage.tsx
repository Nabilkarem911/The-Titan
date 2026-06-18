import { useState } from 'react';
import { Store, Download, Star, Search } from 'lucide-react';

const SAMPLE_LISTINGS = [
  { id: '1', name: 'Code Reviewer Pro', type: 'agent', author: 'Titan Team', rating: 4.8, downloads: 1250, description: 'Advanced code review with security scanning', verified: true },
  { id: '2', name: 'Slack Notifier', type: 'tool', author: 'Community', rating: 4.5, downloads: 890, description: 'Send rich Slack notifications with attachments', verified: false },
  { id: '3', name: 'Data Pipeline', type: 'workflow', author: 'Titan Team', rating: 4.9, downloads: 2100, description: 'ETL workflow: extract → transform → load → report', verified: true },
  { id: '4', name: 'SEO Auditor', type: 'agent', author: 'Community', rating: 4.3, downloads: 670, description: 'Full SEO audit with actionable recommendations', verified: false },
  { id: '5', name: 'Invoice Generator', type: 'tool', author: 'Titan Team', rating: 4.7, downloads: 1500, description: 'Professional invoices from structured data', verified: true },
];

export default function MarketplacePage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = SAMPLE_LISTINGS.filter((l) => {
    if (filter !== 'all' && l.type !== filter) return false;
    if (query && !l.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="w-6 h-6 text-orange-500" /> Marketplace</h1>
      <div className="flex gap-2">
        <div className="flex-1 relative"><Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents, tools, workflows..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-orange-500" /></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2"><option value="all">All</option><option value="agent">Agents</option><option value="tool">Tools</option><option value="workflow">Workflows</option></select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div key={item.id} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-zinc-600 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div><h3 className="font-semibold">{item.name}</h3><span className="text-xs bg-zinc-800 px-2 py-0.5 rounded capitalize">{item.type}</span></div>
              {item.verified && <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">Verified</span>}
            </div>
            <p className="text-sm text-zinc-400 mt-2">{item.description}</p>
            <div className="flex items-center justify-between mt-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" /> {item.rating}</span>
              <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {item.downloads}</span>
              <span>by {item.author}</span>
            </div>
            <button className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 rounded-lg text-sm hover:bg-orange-700"><Download className="w-3 h-3" /> Install</button>
          </div>
        ))}
      </div>
    </div>
  );
}
