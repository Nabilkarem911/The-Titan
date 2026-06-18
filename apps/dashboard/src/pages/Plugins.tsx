import { Puzzle, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import type { Plugin } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function Plugins() {
  const { data, loading, error, refetch } = useApi(() => api.listPlugins(), []);

  const handleDelete = async (id: string) => {
    try {
      await api.deletePlugin(id);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-500/10">
          <Puzzle className="h-5 w-5 text-teal-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Plugins</h2>
          <p className="text-sm text-slate-400">Manage installed plugins and extensions</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<Puzzle className="h-6 w-6 text-slate-400" />}
          title="No plugins installed"
          description="Install plugins to extend Titan's capabilities."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((plugin: Plugin) => (
            <div key={plugin.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white">{plugin.name}</h3>
                <span className={`badge ${plugin.enabled ? 'badge-success' : 'badge-warning'}`}>
                  {plugin.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2">v{plugin.version}</p>
              {plugin.description && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{plugin.description}</p>
              )}
              <button
                onClick={() => handleDelete(plugin.id)}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Uninstall
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
