import { useState, useEffect } from 'react';
import {
  Puzzle,
  Plus,
  Trash2,
  Search,
  AlertCircle,
  Power,
  User,
} from 'lucide-react';

interface PluginItem {
  id: string;
  name: string;
  description: string | null;
  author: string | null;
  source: string;
  status: 'enabled' | 'disabled' | 'error';
  tags: string[];
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
}

interface PluginDetail extends PluginItem {
  versions: Array<{
    id: string;
    version: string;
    status: string;
    entrypoint: string | null;
    createdAt: string;
  }>;
}

import { API_BASE, getToken } from '../api/client';

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [pluginDetail, setPluginDetail] = useState<PluginDetail | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  // Install form
  const [installName, setInstallName] = useState('');
  const [installDesc, setInstallDesc] = useState('');
  const [installAuthor, setInstallAuthor] = useState('');
  const [installTags, setInstallTags] = useState('');
  const [installVersion, setInstallVersion] = useState('0.1.0');
  const [installCode, setInstallCode] = useState('');

  const fetchPlugins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/plugins`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: PluginItem[] };
      setPlugins(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/plugins/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as PluginDetail;
      setPluginDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  useEffect(() => {
    if (selectedPlugin) fetchDetail(selectedPlugin);
  }, [selectedPlugin]);

  const handleToggle = async (id: string, current: string) => {
    const next = current === 'enabled' ? 'disabled' : 'enabled';
    try {
      const res = await fetch(`${API_BASE}/plugins/${id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      await fetchPlugins();
      if (selectedPlugin === id) await fetchDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plugin?')) return;
    try {
      const res = await fetch(`${API_BASE}/plugins/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      if (selectedPlugin === id) setSelectedPlugin(null);
      await fetchPlugins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleInstall = async () => {
    if (!installName.trim()) {
      setError('Name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/plugins`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: installName,
          description: installDesc || undefined,
          author: installAuthor || undefined,
          source: 'local',
          tags: installTags.split(',').map((t) => t.trim()).filter(Boolean),
          version: installVersion,
          code: installCode || undefined,
          checksum: 'sha256-' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, '0')).join(''),
        }),
      });
      if (!res.ok) throw new Error('Install failed');
      setShowInstall(false);
      setInstallName('');
      setInstallDesc('');
      setInstallAuthor('');
      setInstallTags('');
      setInstallVersion('0.1.0');
      setInstallCode('');
      await fetchPlugins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
    }
  };

  const filtered = plugins.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'enabled': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'disabled': return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
      case 'error': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-500/20 text-rose-400">
            <Puzzle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Plugin Marketplace</h3>
            <p className="text-xs text-slate-500">Browse, install, and manage tool plugins</p>
          </div>
        </div>
        <button onClick={() => setShowInstall(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Install Plugin
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plugins by name, description, or tag..."
          className="input pl-9"
        />
      </div>

      {/* Install Form */}
      {showInstall && (
        <div className="card space-y-4">
          <h4 className="text-sm font-medium text-white">Install New Plugin</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Name</label>
              <input value={installName} onChange={(e) => setInstallName(e.target.value)} placeholder="my-tool" className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Version</label>
              <input value={installVersion} onChange={(e) => setInstallVersion(e.target.value)} placeholder="0.1.0" className="input" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Description</label>
            <input value={installDesc} onChange={(e) => setInstallDesc(e.target.value)} placeholder="What does this plugin do?" className="input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Author</label>
              <input value={installAuthor} onChange={(e) => setInstallAuthor(e.target.value)} placeholder="Your name" className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Tags (comma separated)</label>
              <input value={installTags} onChange={(e) => setInstallTags(e.target.value)} placeholder="utility, search" className="input" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Code (optional)</label>
            <textarea value={installCode} onChange={(e) => setInstallCode(e.target.value)} rows={4} placeholder="Plugin JavaScript code..." className="input resize-none font-mono text-xs" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleInstall} className="btn-primary">
              <Plus className="h-4 w-4" />
              Install
            </button>
            <button onClick={() => setShowInstall(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
              <Puzzle className="h-10 w-10 mb-2 text-slate-600" />
              <p className="text-sm">No plugins found</p>
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPlugin(p.id)}
                className={`card p-4 cursor-pointer hover:bg-slate-800/40 transition-colors ${selectedPlugin === p.id ? 'ring-1 ring-indigo-500/40' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Puzzle className="h-4 w-4 text-rose-400" />
                    <span className="text-sm font-medium text-slate-200">{p.name}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor(p.status)}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2 line-clamp-2">{p.description || 'No description'}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {p.tags.slice(0, 4).map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">{t}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {p.author || 'Unknown'}
                  </span>
                  <span>{p.source}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="card space-y-4">
          {selectedPlugin && pluginDetail ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
                <div>
                  <h4 className="text-sm font-medium text-white">{pluginDetail.name}</h4>
                  <p className="text-xs text-slate-500">{pluginDetail.id.slice(0, 8)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor(pluginDetail.status)}`}>
                  {pluginDetail.status}
                </span>
              </div>

              <p className="text-xs text-slate-400">{pluginDetail.description || 'No description'}</p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-800/50">
                  <div className="text-slate-500">Author</div>
                  <div className="text-white">{pluginDetail.author || '—'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50">
                  <div className="text-slate-500">Source</div>
                  <div className="text-white">{pluginDetail.source}</div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Tags</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {pluginDetail.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300">{t}</span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Versions</label>
                <div className="space-y-1 mt-1">
                  {pluginDetail.versions.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-300">{v.version}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${v.status === 'published' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleToggle(pluginDetail.id, pluginDetail.status)}
                  className={`btn-secondary flex-1 ${pluginDetail.status === 'enabled' ? 'text-amber-400' : 'text-emerald-400'}`}
                >
                  <Power className="h-4 w-4" />
                  {pluginDetail.status === 'enabled' ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleDelete(pluginDetail.id)} className="btn-danger px-3">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Puzzle className="h-8 w-8 mb-2 text-slate-600" />
              <p className="text-sm">Select a plugin to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
