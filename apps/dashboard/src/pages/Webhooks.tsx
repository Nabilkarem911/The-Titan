import { useState, useEffect } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  Copy,
  Save,
  Eye,
  EyeOff,
  Send,
} from 'lucide-react';

interface WebhookItem {
  id: string;
  name: string;
  agentId: string;
  promptTemplate: string;
  enabled: boolean;
  events: string[];
  triggerCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  webhookUrl: string;
  secret?: string;
}

interface Delivery {
  webhookId: string;
  runId: string;
  status: string;
  error: string | null;
  deliveredAt: string;
}

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? '/api/v1';
const getToken = () => localStorage.getItem('titan_access_token') ?? '';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // Form
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [events, setEvents] = useState('');

  const fetchWebhooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/webhooks`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: WebhookItem[] };
      setWebhooks(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveries = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/webhooks/${id}/deliveries`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: Delivery[] };
      setDeliveries(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  useEffect(() => {
    if (selectedWebhook) fetchDeliveries(selectedWebhook);
  }, [selectedWebhook]);

  const resetForm = () => {
    setName('');
    setAgentId('');
    setPromptTemplate('');
    setEnabled(true);
    setEvents('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !agentId.trim() || !promptTemplate.trim()) {
      setError('Name, Agent ID, and Prompt Template are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/webhooks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          agentId,
          promptTemplate,
          enabled,
          events: events.trim() ? events.split(',').map((e) => e.trim()) : ['*'],
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      resetForm();
      await fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const handleUpdate = async (id: string, patch: Partial<WebhookItem>) => {
    try {
      const res = await fetch(`${API_BASE}/webhooks/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Update failed');
      await fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      const res = await fetch(`${API_BASE}/webhooks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      if (selectedWebhook === id) setSelectedWebhook(null);
      await fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleRotate = async (id: string) => {
    if (!confirm('Rotate the signing secret? The old secret will stop working.')) return;
    try {
      const res = await fetch(`${API_BASE}/webhooks/${id}/rotate-secret`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Rotate failed');
      const data = await res.json() as WebhookItem;
      setShowSecret((prev) => ({ ...prev, [id]: true }));
      await fetchWebhooks();
      // Show the new secret
      setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, secret: data.secret } : w)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotate failed');
    }
  };

  const startEdit = (wh: WebhookItem) => {
    setEditingId(wh.id);
    setName(wh.name);
    setAgentId(wh.agentId);
    setPromptTemplate(wh.promptTemplate);
    setEnabled(wh.enabled);
    setEvents(wh.events.join(', '));
    setShowForm(true);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await handleUpdate(editingId, { name, agentId, promptTemplate, enabled });
    resetForm();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-pink-500/20 text-pink-400">
            <Webhook className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Webhooks</h3>
            <p className="text-xs text-slate-500">Manage incoming webhooks and delivery logs</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          New Webhook
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card space-y-4">
          <h4 className="text-sm font-medium text-white">{editingId ? 'Edit Webhook' : 'New Webhook'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="GitHub PR webhook" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Agent ID</label>
              <input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="agent-123" className="input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Prompt Template</label>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="What should the agent do when triggered?"
              rows={3}
              className="input resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Events (comma separated, or leave empty for all)</label>
            <input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="push, pull_request, issue" className="input" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-indigo-600" />
            <span className="text-sm text-slate-300">Enabled</span>
          </label>
          <div className="flex gap-2">
            <button onClick={editingId ? handleSaveEdit : handleCreate} className="btn-primary">
              <Save className="h-4 w-4" />
              {editingId ? 'Save' : 'Create'}
            </button>
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Webhook className="h-10 w-10 mb-2 text-slate-600" />
              <p className="text-sm">No webhooks yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Agent</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {webhooks.map((wh) => (
                  <tr
                    key={wh.id}
                    onClick={() => setSelectedWebhook(wh.id)}
                    className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${selectedWebhook === wh.id ? 'bg-slate-800/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-200">{wh.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{wh.webhookUrl}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 hidden sm:table-cell">{wh.agentId}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 text-xs ${wh.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {wh.enabled ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {wh.enabled ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleUpdate(wh.id, { enabled: !wh.enabled })} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Toggle">
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button onClick={() => startEdit(wh)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Edit">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleRotate(wh.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors" title="Rotate Secret">
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(wh.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        <div className="card space-y-4">
          {selectedWebhook ? (
            (() => {
              const wh = webhooks.find((w) => w.id === selectedWebhook);
              if (!wh) return <p className="text-sm text-slate-500">Webhook not found</p>;
              return (
                <>
                  <h4 className="text-sm font-medium text-white border-b border-slate-800/50 pb-2">{wh.name}</h4>

                  {wh.secret && (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Signing Secret</label>
                      <div className="flex gap-2">
                        <input
                          type={showSecret[wh.id] ? 'text' : 'password'}
                          value={wh.secret}
                          readOnly
                          className="input text-xs font-mono flex-1"
                        />
                        <button onClick={() => setShowSecret((prev) => ({ ...prev, [wh.id]: !prev[wh.id] }))} className="btn-secondary px-2">
                          {showSecret[wh.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button onClick={() => copyToClipboard(wh.secret!)} className="btn-secondary px-2">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Webhook URL</label>
                    <div className="flex gap-2">
                      <input value={`${window.location.origin}${wh.webhookUrl}`} readOnly className="input text-xs font-mono flex-1" />
                      <button onClick={() => copyToClipboard(`${window.location.origin}${wh.webhookUrl}`)} className="btn-secondary px-2">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-800/50">
                      <div className="text-slate-500">Triggers</div>
                      <div className="text-white font-medium">{wh.triggerCount}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/50">
                      <div className="text-slate-500">Last</div>
                      <div className="text-white font-medium">{wh.lastTriggeredAt ? new Date(wh.lastTriggeredAt).toLocaleDateString() : 'Never'}</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Events</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {wh.events.map((e) => (
                        <span key={e} className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300">{e}</span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-800/50 pt-3">
                    <h5 className="text-xs font-medium text-slate-300 mb-2">Recent Deliveries ({deliveries.length})</h5>
                    {deliveries.length === 0 ? (
                      <p className="text-xs text-slate-500">No deliveries yet</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {deliveries.map((d) => (
                          <div key={`${d.webhookId}-${d.deliveredAt}`} className="flex items-center gap-2 text-xs">
                            <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <span className="text-slate-400">{d.runId.slice(0, 8)}</span>
                            <span className="text-slate-500 ml-auto">{new Date(d.deliveredAt).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Send className="h-8 w-8 mb-2 text-slate-600" />
              <p className="text-sm">Select a webhook to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
