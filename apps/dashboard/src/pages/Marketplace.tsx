import { useState, useEffect, useCallback } from 'react';
import { Store, Search, Download, CheckCircle, Loader2, Power, Trash2, Tag, Wrench } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

interface LibraryPlugin {
  key: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  category: string;
  toolsCount: number;
  tools: Array<{ name: string; description: string }>;
}

interface InstalledPlugin {
  id: string;
  name: string;
  description: string | null;
  status: string;
  source: string;
  tags: string[] | null;
  author: string | null;
  created_at: string;
}

export default function Marketplace() {
  const [library, setLibrary] = useState<LibraryPlugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [libRes, instRes] = await Promise.all([
        api.get<{ items: LibraryPlugin[] }>('/plugins/library'),
        api.get<{ items: InstalledPlugin[] }>('/plugins'),
      ]);
      setLibrary(libRes.items);
      setInstalled(instRes.items);
    } catch {
      toast.error('Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isInstalled = (name: string) => installed.some(p => p.name === name);

  const handleInstall = async (key: string) => {
    setInstalling(key);
    try {
      await api.post(`/plugins/library/${key}/install`, {});
      toast.success('Plugin installed — enabling now');
      await load();
      // Find the newly installed plugin and enable it
      const newPlugin = installed.find(p => p.name === library.find(l => l.key === key)?.name);
      if (newPlugin) {
        await api.patch(`/plugins/${newPlugin.id}/status`, { status: 'enabled' });
        toast.success('Plugin enabled!');
        load();
      }
    } catch (err) {
      toast.error('Install failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setInstalling(null);
    }
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    setToggling(id);
    const newStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled';
    try {
      await api.patch(`/plugins/${id}/status`, { status: newStatus });
      toast.success(`Plugin ${newStatus}`);
      load();
    } catch {
      toast.error('Status change failed');
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete plugin "${name}"?`)) return;
    try {
      await api.delete(`/plugins/${id}`);
      toast.success('Plugin deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const categories = ['all', ...Array.from(new Set(library.map(p => p.category)))];
  const filtered = library.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = category === 'all' || p.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-h1 text-text-primary">Plugin Marketplace</h1>
        <p className="text-small text-text-secondary mt-1">Browse, install, and manage agent skills and plugins</p>
      </div>

      {/* Installed plugins */}
      {installed.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              Installed Plugins ({installed.length})
            </h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {installed.map((plugin) => (
              <div key={plugin.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{plugin.name}</p>
                  <p className="text-caption text-text-muted truncate">{plugin.description || 'No description'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {plugin.tags?.map((t, i) => (
                      <span key={i} className="badge bg-elevated text-text-muted text-caption">{t}</span>
                    ))}
                  </div>
                </div>
                <span className={cn(
                  'badge text-caption',
                  plugin.status === 'enabled' ? 'bg-success/10 text-success' : 'bg-text-muted/10 text-text-muted',
                )}>
                  {plugin.status}
                </span>
                <button
                  onClick={() => handleToggle(plugin.id, plugin.status)}
                  disabled={toggling === plugin.id}
                  className="btn-icon shrink-0"
                  title={plugin.status === 'enabled' ? 'Disable' : 'Enable'}
                >
                  {toggling === plugin.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(plugin.id, plugin.name)} className="btn-icon shrink-0 hover:text-error" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plugins..."
            className="input pl-9"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input max-w-[180px]">
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>
      </div>

      {/* Library grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plugin) => {
            const installedAlready = isInstalled(plugin.name);
            return (
              <div key={plugin.key} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-btn bg-accent-primary/10 flex items-center justify-center">
                      <Store className="w-5 h-5 text-accent-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-text-primary">{plugin.name}</h3>
                      <p className="text-caption text-text-muted">v{plugin.version}</p>
                    </div>
                  </div>
                  {installedAlready && <CheckCircle className="w-4 h-4 text-success" />}
                </div>

                <p className="text-small text-text-secondary flex-1">{plugin.description}</p>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {plugin.tags.slice(0, 4).map((t, i) => (
                    <span key={i} className="badge bg-elevated text-text-muted text-caption">
                      <Tag className="w-2.5 h-2.5 inline mr-0.5" />{t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-caption text-text-muted">
                  <Wrench className="w-3 h-3" />
                  {plugin.toolsCount} tool{plugin.toolsCount !== 1 ? 's' : ''}
                  <span className="ml-auto">{plugin.category}</span>
                </div>

                <button
                  onClick={() => handleInstall(plugin.key)}
                  disabled={installing === plugin.key || installedAlready}
                  className={cn('btn w-full', installedAlready ? 'btn-secondary opacity-50' : 'btn-primary')}
                >
                  {installing === plugin.key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : installedAlready ? (
                    <><CheckCircle className="w-4 h-4" /> Installed</>
                  ) : (
                    <><Download className="w-4 h-4" /> Install</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-small text-text-secondary">No plugins found</p>
        </div>
      )}
    </div>
  );
}
