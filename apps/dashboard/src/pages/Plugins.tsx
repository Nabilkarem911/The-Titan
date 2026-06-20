import { useApi } from '../hooks/useApi';
import { Puzzle, Search } from 'lucide-react';
import { useState } from 'react';
import type { ListResponse, Plugin } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { StatusBadge } from '../components/StatusBadge';
import { useDebounce } from '../hooks/useDebounce';

export default function Plugins() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading, error, refetch } = useApi<ListResponse<Plugin>>(
    debouncedSearch ? `/plugins/search?q=${encodeURIComponent(debouncedSearch)}` : '/plugins',
  );

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-h1 text-text-primary flex items-center gap-2">
          <Puzzle className="w-6 h-6 text-accent-secondary" />
          Plugins
        </h1>
        <p className="text-small text-text-secondary mt-1">Browse and manage installed plugins</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plugins..." className="input pl-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data?.items.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((plugin) => (
            <div key={plugin.id} className="card-hover p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-btn bg-accent-secondary/10 flex items-center justify-center">
                  <Puzzle className="w-5 h-5 text-accent-secondary" />
                </div>
                <StatusBadge status={plugin.status} />
              </div>
              <h3 className="text-h3 text-text-primary mb-1">{plugin.name}</h3>
              <p className="text-small text-text-secondary line-clamp-2 mb-3">{plugin.description || 'No description'}</p>
              {plugin.tags && plugin.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {plugin.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="badge bg-elevated text-text-secondary">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Puzzle} title="No plugins found" description={search ? "Try a different search term" : "Install plugins to extend functionality"} />
      )}
    </div>
  );
}
