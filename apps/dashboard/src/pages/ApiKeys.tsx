import { useState } from 'react';
import { KeyRound, Plus, Trash2, Copy } from 'lucide-react';
import { api } from '../api/client';
import type { ApiKey } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonTable } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function ApiKeys() {
  const { data, loading, error, refetch } = useApi(() => api.listApiKeys(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreateError(null);
    try {
      const result = await api.createApiKey({ name, permissions: ['*'] });
      setNewKey(result.key);
      setCreating(false);
      setName('');
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create API key');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteApiKey(id);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch((err) => console.error('Copy failed:', err));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10">
            <KeyRound className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">API Keys</h2>
            <p className="text-sm text-slate-400">Manage API access keys</p>
          </div>
        </div>
        <button onClick={() => setCreating(!creating)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" />
          New Key
        </button>
      </div>

      {/* New key display */}
      {newKey && (
        <div className="card bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-400 mb-1">API Key created! Copy it now - it won't be shown again.</p>
              <code className="text-xs text-emerald-300 font-mono bg-emerald-500/10 px-2 py-1 rounded">{newKey}</code>
            </div>
            <button onClick={() => copyToClipboard(newKey)} className="btn-secondary text-xs">
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-slate-500 mt-2 hover:text-slate-400">
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="card space-y-3">
          <h3 className="text-sm font-medium text-white">Create API Key</h3>
          {createError && (
            <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{createError}</div>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. CI/CD)"
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
          icon={<KeyRound className="h-6 w-6 text-slate-400" />}
          title="No API keys"
          description="Create an API key to authenticate programmatic access."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Prefix</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Created</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Last Used</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((key: ApiKey) => (
                <tr key={key.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300">{key.name}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{key.prefix}...</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(key.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(key.id)}
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
