import { useState, useEffect } from 'react';
import { Store, Download, Star, Search, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';

interface Listing {
  id: string;
  name: string;
  type: string;
  author: string;
  rating: number;
  downloads: number;
  description: string;
  verified: boolean;
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/marketplace`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { items?: Listing[] };
      setListings(d.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchListings(); }, []);

  const filtered = listings.filter((l) => {
    if (filter !== 'all' && l.type !== filter) return false;
    if (query && !l.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/20 text-orange-400">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Marketplace</h3>
            <p className="text-xs text-slate-500">Browse and install agents, tools, and workflows</p>
          </div>
        </div>
        <button onClick={fetchListings} className="btn-secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchListings} />
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents, tools, workflows..."
                className="input pl-10"
              />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input w-32">
              <option value="all">All</option>
              <option value="agent">Agents</option>
              <option value="tool">Tools</option>
              <option value="workflow">Workflows</option>
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card">
                  <div className="h-4 w-24 bg-slate-700/50 rounded mb-3" />
                  <div className="h-3 w-full bg-slate-800/50 rounded mb-2" />
                  <div className="h-3 w-2/3 bg-slate-800/50 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Store className="h-6 w-6 text-slate-400" />}
              title="No listings found"
              description={query ? 'Try a different search term' : 'Marketplace listings will appear when available'}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((item) => (
                <div key={item.id} className="card hover:border-slate-700 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                      <span className="badge mt-1 capitalize">{item.type}</span>
                    </div>
                    {item.verified && <span className="badge-info">Verified</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{item.description}</p>
                  <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" /> {item.rating}</span>
                    <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {item.downloads}</span>
                    <span>by {item.author}</span>
                  </div>
                  <button className="btn-primary w-full mt-3 text-xs justify-center">
                    <Download className="h-3 w-3" /> Install
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
