import { useState } from 'react';
import { Webhook, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { toast } from 'sonner';
import type { ListResponse, Webhook as WebhookType } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonRow } from '../components/LoadingSkeleton';
import { StatusBadge } from '../components/StatusBadge';
import { formatRelativeTime } from '../utils/format';

export default function Webhooks() {
  const { data, isLoading, error, refetch } = useApi<ListResponse<WebhookType>>('/webhooks');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', agentId: 'default', promptTemplate: '', events: 'run.completed' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/webhooks', {
        name: form.name,
        agentId: form.agentId,
        promptTemplate: form.promptTemplate,
        events: form.events.split(',').map(s => s.trim()),
      });
      toast.success('Webhook created');
      setShowCreate(false);
      setForm({ name: '', agentId: 'default', promptTemplate: '', events: 'run.completed' });
      refetch();
    } catch (err) {
      toast.error('Failed to create webhook', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      await api.delete(`/webhooks/${id}`);
      toast.success('Webhook deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleRotateSecret = async (id: string) => {
    try {
      await api.post(`/webhooks/${id}/rotate-secret`);
      toast.success('Secret rotated');
      refetch();
    } catch (err) {
      toast.error('Failed to rotate secret', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <Webhook className="w-6 h-6 text-accent-secondary" />
            Webhooks
          </h1>
          <p className="text-small text-text-secondary mt-1">Manage webhook endpoints for event notifications</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Webhook
        </button>
      </div>

      {isLoading ? (
        <div className="card">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} columns={3} />)}</div>
      ) : data?.items.length ? (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {data.items.map((webhook) => (
              <div key={webhook.id} className="px-5 py-3 group">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">{webhook.name}</p>
                    <p className="text-caption text-text-muted font-mono truncate">{webhook.webhookUrl}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={webhook.enabled ? 'enabled' : 'disabled'} />
                      <span className="text-caption text-text-muted">{webhook.events.join(', ')}</span>
                      {webhook.lastTriggeredAt && <span className="text-caption text-text-muted">Last: {formatRelativeTime(webhook.lastTriggeredAt)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleRotateSecret(webhook.id)} className="btn-icon !w-7 !h-7" title="Rotate secret">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(webhook.id)} className="btn-icon !w-7 !h-7 text-error hover:text-error" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={Webhook} title="No webhooks" description="Create a webhook to receive event notifications" action={{ label: 'Create Webhook', onClick: () => setShowCreate(true) }} />
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreate(false)}>
          <div className="card p-6 max-w-lg w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 text-text-primary mb-4">Create Webhook</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Agent ID</label>
                <input value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} className="input font-mono" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Prompt Template</label>
                <textarea value={form.promptTemplate} onChange={(e) => setForm({ ...form, promptTemplate: e.target.value })} className="input" rows={3} />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Events (comma-separated)</label>
                <input value={form.events} onChange={(e) => setForm({ ...form, events: e.target.value })} className="input" required />
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
