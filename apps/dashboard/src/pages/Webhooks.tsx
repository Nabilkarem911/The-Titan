import React, { useState } from 'react';
import { Webhook, Plus, Edit3, Trash2, Save, X, TestTube2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames, formatRelativeTime } from '../utils/format';
import type { Webhook as WebhookType } from '../api/client';

export default function Webhooks() {
  const [editing, setEditing] = useState<Partial<WebhookType> | null>(null);
  const { data: webhooks, error, isLoading, refetch } = useApi<WebhookType[]>(() => api.getWebhooks(), []);

  const save = async () => {
    if (!editing) return;
    if (editing.id) await api.updateWebhook(editing.id, editing);
    else await api.createWebhook(editing);
    setEditing(null); refetch();
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">{webhooks?.length ?? 0} webhooks</p>
        <button onClick={() => setEditing({ name: '', url: '', events: [], enabled: true })} className="btn btn-primary"><Plus className="w-4 h-4" /> New Webhook</button>
      </div>
      {!webhooks || webhooks.length === 0 ? (
        <EmptyState icon={<Webhook className="w-7 h-7 text-text-muted" />} title="No webhooks" message="Configure webhooks to receive event notifications" />
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Name</th><th>URL</th><th>Events</th><th>Status</th><th>Last Triggered</th><th>Actions</th></tr></thead>
            <tbody>
              {webhooks.map((wh) => (
                <tr key={wh.id}>
                  <td className="text-text-primary font-medium">{wh.name}</td>
                  <td className="text-xs font-mono text-text-secondary max-w-[200px] truncate">{wh.url}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {wh.events.slice(0, 3).map((ev) => <span key={ev} className="badge badge-info text-[10px]">{ev}</span>)}
                      {wh.events.length > 3 && <span className="badge badge-neutral text-[10px]">+{wh.events.length - 3}</span>}
                    </div>
                  </td>
                  <td><span className={classNames('badge', wh.enabled ? 'badge-success' : 'badge-neutral')}>{wh.enabled ? 'Active' : 'Disabled'}</span></td>
                  <td className="text-xs">{wh.last_triggered ? formatRelativeTime(wh.last_triggered) : 'Never'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={async () => { await api.testWebhook(wh.id); }} className="btn btn-ghost p-1 text-cyan"><TestTube2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditing({ ...wh })} className="btn btn-ghost p-1"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={async () => { await api.deleteWebhook(wh.id); refetch(); }} className="btn btn-ghost p-1 text-text-muted hover:text-pink"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-text-primary">{editing.id ? 'Edit' : 'New'} Webhook</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm text-text-secondary mb-1.5">Name</label><input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">URL</label><input value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} className="input font-mono" placeholder="https://..." /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Events (comma-separated)</label><input value={editing.events?.join(', ') ?? ''} onChange={(e) => setEditing({ ...editing, events: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="input" /></div>
              <div className="flex gap-2"><button onClick={save} className="btn btn-primary flex-1"><Save className="w-4 h-4" /> Save</button><button onClick={() => setEditing(null)} className="btn btn-secondary">Cancel</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
