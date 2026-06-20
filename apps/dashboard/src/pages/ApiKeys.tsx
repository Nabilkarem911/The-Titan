import { useState } from 'react';
import { KeyRound, Plus, Trash2, Copy, Check } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { toast } from 'sonner';
import type { ListResponse, ApiKey, ApiKeyCreated } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonRow } from '../components/LoadingSkeleton';
import { formatRelativeTime } from '../utils/format';

export default function ApiKeys() {
  const { data, isLoading, error, refetch } = useApi<ListResponse<ApiKey>>('/api-keys');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.post<ApiKeyCreated>('/api-keys', { name });
      setCreatedKey(result.key);
      toast.success('API key created');
      setShowCreate(false);
      setName('');
      refetch();
    } catch (err) {
      toast.error('Failed to create key', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key?')) return;
    try {
      await api.delete(`/api-keys/${id}`);
      toast.success('Key revoked');
      refetch();
    } catch (err) {
      toast.error('Failed to revoke', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-accent-primary" />
            API Keys
          </h1>
          <p className="text-small text-text-secondary mt-1">Manage your API keys for programmatic access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Key
        </button>
      </div>

      {createdKey && (
        <div className="card p-4 border-accent-primary/30">
          <p className="text-small text-text-secondary mb-2">Copy your API key now — it won't be shown again:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-text-primary bg-void px-3 py-2 rounded-btn truncate">{createdKey}</code>
            <button onClick={copyKey} className="btn-secondary">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
            <button onClick={() => setCreatedKey(null)} className="btn-ghost">Dismiss</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} columns={3} />)}</div>
      ) : data?.items.length ? (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {data.items.map((key) => (
              <div key={key.id} className="flex items-center justify-between px-5 py-3 group">
                <div>
                  <p className="text-sm text-text-primary">{key.name}</p>
                  <p className="text-caption text-text-muted font-mono">{key.keyPrefix}...{key.scopes.join(', ')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {key.lastUsedAt && <span className="text-caption text-text-muted">Last used {formatRelativeTime(key.lastUsedAt)}</span>}
                  <button onClick={() => handleRevoke(key.id)} className="btn-icon text-error hover:text-error" title="Revoke">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={KeyRound} title="No API keys" description="Create an API key for programmatic access" action={{ label: 'Create Key', onClick: () => setShowCreate(true) }} />
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreate(false)}>
          <div className="card p-6 max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 text-text-primary mb-4">Create API Key</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
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
