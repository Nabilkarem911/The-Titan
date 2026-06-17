import { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  Save,
  Clock,
  CheckCircle,
  X,
} from 'lucide-react';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  workspaceId: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface CreatedKey extends ApiKeyItem {
  key: string;
}

import { API_BASE, getToken } from '../api/client';

const SCOPES = [
  'agent:run',
  'agent:read',
  'file:read',
  'file:write',
  'webhook:trigger',
  'metrics:read',
  'audit:read',
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<CreatedKey | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['agent:run']);
  const [expiresDays, setExpiresDays] = useState('');

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api-keys`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: ApiKeyItem[] };
      setKeys(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      const body: Record<string, unknown> = { name, scopes: selectedScopes };
      if (expiresDays) {
        const d = new Date();
        d.setDate(d.getDate() + Number(expiresDays));
        body.expiresAt = d.toISOString();
      }
      const res = await fetch(`${API_BASE}/api-keys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Create failed');
      const data = await res.json() as CreatedKey;
      setNewlyCreated(data);
      setShowForm(false);
      setName('');
      setSelectedScopes(['agent:run']);
      setExpiresDays('');
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? It will stop working immediately.')) return;
    try {
      const res = await fetch(`${API_BASE}/api-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Revoke failed');
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-500/20 text-sky-400">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">API Keys</h3>
            <p className="text-xs text-slate-500">Programmatic access keys for external integrations</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          New Key
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Newly created key warning */}
      {newlyCreated && (
        <div className="card border border-amber-500/20 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              API Key Created — Copy it now, you won't see it again
            </h4>
            <button onClick={() => setNewlyCreated(null)} className="text-slate-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={newlyCreated.key}
              readOnly
              className="input text-xs font-mono flex-1"
            />
            <button onClick={() => setShowKey(!showKey)} className="btn-secondary px-2">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button onClick={() => copyToClipboard(newlyCreated.key)} className="btn-secondary px-2">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card space-y-4">
          <h4 className="text-sm font-medium text-white">New API Key</h4>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="CI/CD integration" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Scopes</label>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((scope) => (
                <button
                  key={scope}
                  onClick={() => toggleScope(scope)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    selectedScopes.includes(scope)
                      ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/30 hover:text-slate-300'
                  }`}
                >
                  {selectedScopes.includes(scope) && <CheckCircle className="h-3 w-3 inline mr-1" />}
                  {scope}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Expires in (days, optional)</label>
            <input
              type="number"
              value={expiresDays}
              onChange={(e) => setExpiresDays(e.target.value)}
              placeholder="30"
              min={1}
              max={365}
              className="input w-32"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary">
              <Save className="h-4 w-4" />
              Create Key
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Key className="h-10 w-10 mb-2 text-slate-600" />
            <p className="text-sm">No API keys yet</p>
            <p className="text-xs text-slate-600 mt-1">Create a key to use Titan via API</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Prefix</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Scopes</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Last Used</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-200">{k.name}</div>
                    <div className="text-[10px] text-slate-600">{new Date(k.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-400 hidden sm:table-cell">{k.keyPrefix}...</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.slice(0, 3).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">{s}</span>
                      ))}
                      {k.scopes.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-500">+{k.scopes.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                    {k.expiresAt && (
                      <div className="text-[10px] text-amber-500/70 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        Expires {new Date(k.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Revoke"
                      >
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
    </div>
  );
}
