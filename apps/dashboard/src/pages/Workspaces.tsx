import { useState } from 'react';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import type { Workspace } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function Workspaces() {
  const { data, loading, error, refetch } = useApi(() => api.listWorkspaces(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreateError(null);
    try {
      await api.createWorkspace({ name, description: description || null });
      setCreating(false);
      setName('');
      setDescription('');
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteWorkspace(id);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-500/10">
            <Building2 className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Workspaces</h2>
            <p className="text-sm text-slate-400">Manage team workspaces and members</p>
          </div>
        </div>
        <button onClick={() => setCreating(!creating)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" />
          New Workspace
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="card space-y-3">
          <h3 className="text-sm font-medium text-white">Create Workspace</h3>
          {createError && (
            <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{createError}</div>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name"
            className="input w-full"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="input w-full h-20 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary text-sm">Create</button>
            <button onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6 text-slate-400" />}
          title="No workspaces"
          description="Create a workspace to organize your team's work."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((ws: Workspace) => (
            <div key={ws.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white">{ws.name}</h3>
                <span className="badge badge-info">{ws.memberCount} members</span>
              </div>
              {ws.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{ws.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Created {new Date(ws.createdAt).toLocaleDateString()}</span>
                <button
                  onClick={() => handleDelete(ws.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
