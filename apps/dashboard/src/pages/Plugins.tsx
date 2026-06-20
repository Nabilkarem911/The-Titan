import React, { useState } from 'react';
import { Puzzle, Power, Trash2, Download, Plus, X } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames } from '../utils/format';
import type { Plugin } from '../api/client';

export default function Plugins() {
  const [installModal, setInstallModal] = useState(false);
  const [pluginName, setPluginName] = useState('');
  const { data: plugins, error, isLoading, refetch } = useApi<Plugin[]>(() => api.getPlugins(), []);

  const install = async () => {
    if (!pluginName.trim()) return;
    await api.installPlugin({ name: pluginName.trim() });
    setPluginName(''); setInstallModal(false); refetch();
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">{plugins?.length ?? 0} plugins installed</p>
        <button onClick={() => setInstallModal(true)} className="btn btn-primary"><Plus className="w-4 h-4" /> Install Plugin</button>
      </div>
      {!plugins || plugins.length === 0 ? (
        <EmptyState icon={<Puzzle className="w-7 h-7 text-text-muted" />} title="No plugins" message="Extend Titan with plugins" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="card p-5 hover:border-border-light transition-all">
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="font-heading font-semibold text-text-primary">{plugin.name}</h3><p className="text-xs text-text-muted">v{plugin.version} by {plugin.author}</p></div>
                <span className={classNames('badge', plugin.enabled ? 'badge-success' : 'badge-neutral')}>{plugin.enabled ? 'Active' : 'Disabled'}</span>
              </div>
              <p className="text-sm text-text-secondary mb-3 line-clamp-2">{plugin.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">{plugin.capabilities.map((cap) => <span key={cap} className="badge badge-violet text-[10px]">{cap}</span>)}</div>
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <button onClick={async () => { await api.togglePlugin(plugin.id, !plugin.enabled); refetch(); }} className={classNames('btn btn-ghost btn-sm flex-1', plugin.enabled ? 'text-warning' : 'text-success')}>
                  <Power className="w-4 h-4" /> {plugin.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={async () => { await api.uninstallPlugin(plugin.id); refetch(); }} className="btn btn-ghost btn-sm text-text-muted hover:text-pink"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {installModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setInstallModal(false)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-text-primary">Install Plugin</h2>
              <button onClick={() => setInstallModal(false)} className="btn btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm text-text-secondary mb-1.5">Plugin Name</label><input value={pluginName} onChange={(e) => setPluginName(e.target.value)} className="input" placeholder="plugin-name" /></div>
              <div className="flex gap-2"><button onClick={install} className="btn btn-primary flex-1"><Download className="w-4 h-4" /> Install</button><button onClick={() => setInstallModal(false)} className="btn btn-secondary">Cancel</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
