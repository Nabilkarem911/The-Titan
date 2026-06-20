import React, { useState } from 'react';
import { Key, Plus, Trash2, Copy, CheckCheck, X } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { formatRelativeTime } from '../utils/format';
import type { ApiKey } from '../api/client';

export default function ApiKeys() {
  const [createModal, setCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [permissions, setPermissions] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { data: keys, error, isLoading, refetch } = useApi<ApiKey[]>(() => api.getApiKeys(), []);

  const create = async () => {
    if (!keyName.trim()) return;
    const result = await api.createApiKey({ name: keyName.trim(), permissions: permissions.split(',').map((s) => s.trim()).filter(Boolean) });
    setCreatedKey(result.key); setKeyName(''); setPermissions(''); refetch();
  };

  const copyKey = () => { if (createdKey) { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000); } };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">{keys?.length ?? 0} API keys</p>
        <button onClick={() => { setCreateModal(true); setCreatedKey(null); }} className="btn btn-primary"><Plus className="w-4 h-4" /> New API Key</button>
      </div>
      {!keys || keys.length === 0 ? (
        <EmptyState icon={<Key className="w-7 h-7 text-text-muted" />} title="No API keys" message="Create API keys for programmatic access" />
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Name</th><th>Key</th><th>Permissions</th><th>Last Used</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td className="text-text-primary font-medium">{key.name}</td>
                  <td className="font-mono text-xs text-text-muted">{key.key_prefix}...</td>
                  <td><div className="flex flex-wrap gap-1">{key.permissions.slice(0, 3).map((p) => <span key={p} className="badge badge-info text-[10px]">{p}</span>)}</div></td>
                  <td className="text-xs">{key.last_used ? formatRelativeTime(key.last_used) : 'Never'}</td>
                  <td className="text-xs">{formatRelativeTime(key.created_at)}</td>
                  <td><button onClick={async () => { await api.deleteApiKey(key.id); refetch(); }} className="btn btn-ghost p-1 text-text-muted hover:text-pink"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCreateModal(false)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-text-primary">{createdKey ? 'API Key Created' : 'New API Key'}</h2>
              <button onClick={() => setCreateModal(false)} className="btn btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            {createdKey ? (
              <div className="space-y-4">
                <p className="text-sm text-warning">Copy this key now. It will not be shown again.</p>
                <div className="flex items-center gap-2 p-3 bg-deep rounded-lg border border-border">
                  <code className="flex-1 text-sm font-mono text-cyan break-all">{createdKey}</code>
                  <button onClick={copyKey} className="btn btn-ghost p-1 shrink-0">{copied ? <CheckCheck className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}</button>
                </div>
                <button onClick={() => setCreateModal(false)} className="btn btn-secondary w-full">Done</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div><label className="block text-sm text-text-secondary mb-1.5">Name</label><input value={keyName} onChange={(e) => setKeyName(e.target.value)} className="input" placeholder="My API Key" /></div>
                <div><label className="block text-sm text-text-secondary mb-1.5">Permissions (comma-separated)</label><input value={permissions} onChange={(e) => setPermissions(e.target.value)} className="input" placeholder="read, write, admin" /></div>
                <div className="flex gap-2"><button onClick={create} disabled={!keyName.trim()} className="btn btn-primary flex-1"><Key className="w-4 h-4" /> Create</button><button onClick={() => setCreateModal(false)} className="btn btn-secondary">Cancel</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
