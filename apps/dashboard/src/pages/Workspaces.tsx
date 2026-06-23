import { useState } from 'react';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import type { ListResponse, Workspace } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { formatRelativeTime } from '../utils/format';

export default function Workspaces() {
  const { data, isLoading, error, refetch } = useApi<ListResponse<Workspace>>('/workspaces');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/workspaces', form);
      toast.success('Workspace created');
      setShowCreate(false);
      setForm({ name: '', slug: '', description: '' });
      refetch();
    } catch (err) {
      toast.error('Failed to create workspace', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workspace?')) return;
    try {
      await api.delete(`/workspaces/${id}`);
      toast.success('Workspace deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="workspaces"
        icon={Building2}
        title="Workspaces"
        subtitle="Manage your workspaces and team members"
        description="Workspaces are isolated environments for different teams or projects. Each workspace has its own agents, runs, memory, and settings. Use this page to create workspaces, manage members, and switch between them."
        tips={[
          'Each workspace is isolated — agents and data don\'t cross over',
          'Invite team members to collaborate on a workspace',
          'Switch workspaces from the sidebar to change context',
        ]}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Workspace
          </button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data?.items.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.items.map((ws) => (
            <div key={ws.id} className="card-hover p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-btn bg-accent-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-accent-primary" />
                </div>
                <button onClick={() => handleDelete(ws.id)} className="btn-icon text-error hover:text-error opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-h3 text-text-primary mb-1">{ws.name}</h3>
              <p className="text-small text-text-secondary line-clamp-2 mb-2">{ws.description || 'No description'}</p>
              <div className="flex items-center gap-3 text-caption text-text-muted">
                <span className="font-mono">{ws.slug}</span>
                <span>{formatRelativeTime(ws.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Building2} title="No workspaces" description="Create a workspace to organize your projects" action={{ label: 'Create Workspace', onClick: () => setShowCreate(true) }} />
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreate(false)}>
          <div className="card p-6 max-w-lg w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 text-text-primary mb-4">Create Workspace</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="input font-mono" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
