import { useState } from 'react';
import { Webhook, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import type { Webhook as WebhookType } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonTable } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function Webhooks() {
  const { data, loading, error, refetch } = useApi(() => api.listWebhooks(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !url.trim()) return;
    setCreateError(null);
    try {
      await api.createWebhook({ name, url, events: ['*'] });
      setCreating(false);
      setName('');
      setUrl('');
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create webhook');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteWebhook(id);
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
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-pink-500/10">
            <Webhook className="h-5 w-5 text-pink-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Webhooks</h2>
            <p className="text-sm text-slate-400">Manage webhook endpoints</p>
          </div>
        </div>
        <button onClick={() => setCreating(!creating)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" />
          New Webhook
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="card space-y-3">
          <h3 className="text-sm font-medium text-white">Create Webhook</h3>
          {createError && (
            <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{createError}</div>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Webhook name"
            className="input w-full"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            className="input w-full"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary text-sm">Create</button>
            <button onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<Webhook className="h-6 w-6 text-slate-400" />}
          title="No webhooks"
          description="Create a webhook to receive event notifications."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">URL</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((wh: WebhookType) => (
                <tr key={wh.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300">{wh.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono truncate max-w-[200px]">{wh.url}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${wh.enabled ? 'badge-success' : 'badge-warning'}`}>
                      {wh.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(wh.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
