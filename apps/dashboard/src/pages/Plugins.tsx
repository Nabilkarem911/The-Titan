import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { Puzzle, Search, Plus, X, Trash2, Power, Store, Download, Check, Star, Eye, Terminal, Loader2, ChevronDown } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { ListResponse, Plugin } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { StatusBadge } from '../components/StatusBadge';
import { useDebounce } from '../hooks/useDebounce';
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

interface PluginDetail extends Plugin {
  manifest?: { tools?: Array<{ name: string; description: string }> };
}

interface PluginRating {
  id: string;
  rating: number;
  userId?: string;
  createdAt: string;
}

export default function Plugins() {
  const [search, setSearch] = useState('');
  const [showInstall, setShowInstall] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    author: '',
    version: '0.1.0',
    code: '',
    codeUrl: '',
    checksum: '',
  });
  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading, error, refetch } = useApi<ListResponse<Plugin>>(
    debouncedSearch ? `/plugins/search?q=${encodeURIComponent(debouncedSearch)}` : '/plugins',
  );

  const allPlugins = data?.items ?? [];
  const categories = Array.from(new Set(allPlugins.flatMap(p => p.tags ?? []))).sort();
  const filteredPlugins = categoryFilter === 'all'
    ? allPlugins
    : allPlugins.filter(p => p.tags?.includes(categoryFilter));

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.checksum) {
      toast.error('Name and checksum are required');
      return;
    }
    if (!form.code && !form.codeUrl) {
      toast.error('Either code or code URL is required');
      return;
    }
    setInstalling(true);
    try {
      await api.post('/plugins', {
        name: form.name,
        description: form.description || undefined,
        author: form.author || undefined,
        source: 'local',
        version: form.version,
        checksum: form.checksum,
        code: form.code || undefined,
        codeUrl: form.codeUrl || undefined,
        manifest: {
          tools: [],
        },
      });
      toast.success('Plugin installed');
      setShowInstall(false);
      setForm({ name: '', description: '', author: '', version: '0.1.0', code: '', codeUrl: '', checksum: '' });
      refetch();
    } catch (err) {
      toast.error('Failed to install plugin', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setInstalling(false);
    }
  };

  const handleToggle = async (plugin: Plugin) => {
    const newStatus = plugin.status === 'enabled' ? 'disabled' : 'enabled';
    try {
      await api.patch(`/plugins/${plugin.id}/status`, { status: newStatus });
      toast.success(`Plugin ${newStatus}`);
      refetch();
    } catch (err) {
      toast.error(`Failed to ${newStatus} plugin`, { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDelete = async (plugin: Plugin) => {
    if (!confirm(`Delete plugin "${plugin.name}"?`)) return;
    try {
      await api.delete(`/plugins/${plugin.id}`);
      toast.success('Plugin deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete plugin', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleInstallBuiltin = async (key: string) => {
    setInstallingKey(key);
    try {
      await api.post(`/plugins/library/${key}/install`);
      toast.success('Plugin installed — enable it to activate');
      setShowLibrary(false);
      refetch();
    } catch (err) {
      toast.error('Failed to install plugin', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setInstallingKey(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <Puzzle className="w-6 h-6 text-accent-secondary" />
            Plugins
          </h1>
          <p className="text-small text-text-secondary mt-1">Browse and manage installed plugins</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLibrary(true)} className="btn-secondary flex items-center gap-2">
            <Store className="w-4 h-4" />
            Plugin Library
          </button>
          <button onClick={() => setShowInstall(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Custom Install
          </button>
        </div>
      </div>

      {showLibrary && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h2 text-text-primary flex items-center gap-2">
              <Store className="w-5 h-5 text-accent-secondary" />
              Plugin Library
            </h2>
            <button onClick={() => setShowLibrary(false)} className="btn-icon text-text-muted hover:text-text-primary">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-small text-text-secondary">Ready-made plugins you can install with one click. After installing, enable the plugin to make its tools available to the agent.</p>
          <LibraryPlugins installingKey={installingKey} onInstall={handleInstallBuiltin} installedNames={new Set(data?.items.map((p) => p.name) ?? [])} />
        </div>
      )}

      {showInstall && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h2 text-text-primary">Install New Plugin</h2>
            <button onClick={() => setShowInstall(false)} className="btn-icon text-text-muted hover:text-text-primary">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleInstall} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="my-plugin" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Version</label>
                <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="input" placeholder="0.1.0" />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Author</label>
                <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="input" placeholder="Author name" />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Checksum *</label>
                <input value={form.checksum} onChange={(e) => setForm({ ...form, checksum: e.target.value })} className="input" placeholder="sha256 hash" required />
              </div>
            </div>
            <div>
              <label className="block text-label text-text-secondary mb-1.5">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="What does this plugin do?" />
            </div>
            <div>
              <label className="block text-label text-text-secondary mb-1.5">Plugin Code (JavaScript)</label>
              <textarea value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input font-mono text-small" rows={6} placeholder="// Plugin code here..." />
              <p className="text-caption text-text-muted mt-1">Or provide a URL to fetch the code from:</p>
              <input value={form.codeUrl} onChange={(e) => setForm({ ...form, codeUrl: e.target.value })} className="input mt-1" placeholder="https://example.com/plugin.js" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={installing} className="btn-primary flex items-center gap-2">
                {installing ? <span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                Install
              </button>
              <button type="button" onClick={() => setShowInstall(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plugins..." className="input pl-9" />
        </div>
        {/* Category Filter */}
        <div className="relative">
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showCategoryDropdown && (
            <div className="absolute right-0 mt-1 w-48 card p-1 z-20 shadow-xl max-h-64 overflow-y-auto">
              <button
                onClick={() => { setCategoryFilter('all'); setShowCategoryDropdown(false); }}
                className={cn('w-full text-left px-3 py-1.5 rounded-btn text-sm transition-colors', categoryFilter === 'all' ? 'bg-accent-primary/10 text-accent-primary' : 'hover:bg-elevated text-text-secondary')}
              >
                All Categories
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
                  className={cn('w-full text-left px-3 py-1.5 rounded-btn text-sm transition-colors', cat === categoryFilter ? 'bg-accent-primary/10 text-accent-primary' : 'hover:bg-elevated text-text-secondary')}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filteredPlugins.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => (
            <div key={plugin.id} className="card-hover p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-btn bg-accent-secondary/10 flex items-center justify-center">
                  <Puzzle className="w-5 h-5 text-accent-secondary" />
                </div>
                <StatusBadge status={plugin.status} />
              </div>
              <h3 className="text-h3 text-text-primary mb-1">{plugin.name}</h3>
              <p className="text-small text-text-secondary line-clamp-2 mb-3">{plugin.description || 'No description'}</p>
              {plugin.tags && plugin.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {plugin.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="badge bg-elevated text-text-secondary">{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3 pt-3 border-t border-border-subtle">
                <button onClick={() => handleToggle(plugin)} className="btn-secondary flex items-center gap-1.5 text-small" title={plugin.status === 'enabled' ? 'Disable' : 'Enable'}>
                  <Power className="w-3.5 h-3.5" />
                  {plugin.status === 'enabled' ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => setSelectedPlugin(plugin)} className="btn-icon text-text-secondary hover:text-accent-primary" title="Details">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(plugin)} className="btn-icon text-error hover:text-error ml-auto" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Puzzle} title="No plugins found" description={search ? "Try a different search term" : "Install plugins to extend functionality"} action={{ label: 'Install Plugin', onClick: () => setShowInstall(true) }} />
      )}

      {selectedPlugin && (
        <PluginDetailsModal plugin={selectedPlugin} onClose={() => setSelectedPlugin(null)} />
      )}
    </div>
  );
}

function LibraryPlugins({ installingKey, onInstall, installedNames }: { installingKey: string | null; onInstall: (key: string) => void; installedNames: Set<string> }) {
  const [libSearch, setLibSearch] = useState('');
  const { data, isLoading, error } = useApi<{ items: LibraryPlugin[] }>('/plugins/library');

  if (error) return <p className="text-small text-error">Failed to load library</p>;
  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  const all = data?.items ?? [];
  const q = libSearch.toLowerCase().trim();
  const filtered = q
    ? all.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q)))
    : all;

  const notInstalled = filtered.filter((p) => !installedNames.has(p.name));
  const installed = filtered.filter((p) => installedNames.has(p.name));

  const renderPluginCard = (plugin: LibraryPlugin, isInstalled: boolean) => (
    <div key={plugin.key} className={`card p-4 flex flex-col gap-3 ${isInstalled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-small font-semibold text-text-primary">{plugin.name}</h4>
          <p className="text-caption text-text-secondary line-clamp-2 mt-0.5">{plugin.description}</p>
        </div>
        <span className="badge bg-accent-secondary/10 text-accent-secondary text-caption shrink-0 ml-2">{plugin.toolsCount} tools</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {plugin.tags.map((tag) => (
          <span key={tag} className="badge bg-elevated text-text-muted text-caption">{tag}</span>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        <span className="text-caption text-text-muted">v{plugin.version}</span>
        {isInstalled ? (
          <span className="flex items-center gap-1 text-caption text-success font-medium">
            <Check className="w-3.5 h-3.5" />
            Installed
          </span>
        ) : (
          <button
            onClick={() => onInstall(plugin.key)}
            disabled={installingKey === plugin.key}
            className="btn-primary flex items-center gap-1.5 text-caption !py-1.5 !px-3"
          >
            {installingKey === plugin.key ? (
              <span className="w-3 h-3 border-2 border-void border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Install
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input value={libSearch} onChange={(e) => setLibSearch(e.target.value)} placeholder="Search library plugins..." className="input pl-9" />
      </div>

      {notInstalled.length > 0 && (
        <div>
          <h3 className="text-label text-text-secondary uppercase tracking-wider mb-3">Available ({notInstalled.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {notInstalled.map((p) => renderPluginCard(p, false))}
          </div>
        </div>
      )}

      {installed.length > 0 && (
        <div>
          <h3 className="text-label text-text-secondary uppercase tracking-wider mb-3">Installed ({installed.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {installed.map((p) => renderPluginCard(p, true))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-small text-text-muted text-center py-8">No plugins match your search.</p>
      )}
    </div>
  );
}

function PluginDetailsModal({ plugin, onClose }: { plugin: Plugin; onClose: () => void }) {
  const [detail, setDetail] = useState<PluginDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<PluginRating[]>([]);
  const [avgRating, setAvgRating] = useState<{ avg: number; count: number } | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showTestConsole, setShowTestConsole] = useState(false);
  const [toolName, setToolName] = useState('');
  const [toolParams, setToolParams] = useState('{}');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<PluginDetail>(`/plugins/${plugin.id}`);
      setDetail(d);
    } catch {
      setDetail({ ...plugin });
    } finally {
      setLoading(false);
    }
  }, [plugin]);

  const loadRatings = useCallback(async () => {
    try {
      const res = await api.get<{ ratings: PluginRating[]; average: { avg: number; count: number } }>(`/plugins/${plugin.id}/ratings`);
      setRatings(res.ratings);
      setAvgRating(res.average);
    } catch {
      /* ignore */
    }
  }, [plugin.id]);

  useEffect(() => { loadDetails(); loadRatings(); }, []);

  const handleRate = async (rating: number) => {
    setUserRating(rating);
    setSubmittingRating(true);
    try {
      await api.post(`/plugins/${plugin.id}/rate`, { rating });
      toast.success('Rating submitted');
      loadRatings();
    } catch (err) {
      toast.error('Failed to submit rating', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleTestTool = async () => {
    if (!toolName.trim()) {
      toast.error('Tool name is required');
      return;
    }
    let parsedParams: unknown;
    try {
      parsedParams = JSON.parse(toolParams);
    } catch {
      toast.error('Invalid JSON params');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ result?: unknown; error?: string }>(`/plugins/${plugin.id}/execute`, {
        tool: toolName.trim(),
        params: parsedParams,
      });
      setTestResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-btn bg-accent-secondary/10 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-accent-secondary" />
            </div>
            <div>
              <h3 className="text-h3 text-text-primary">{plugin.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusBadge status={plugin.status} />
                <span className="text-caption text-text-muted">{plugin.source}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            {detail?.description && (
              <div>
                <span className="text-caption text-text-muted font-medium">Description</span>
                <p className="text-small text-text-secondary mt-1">{detail.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {detail?.author && (
                <div>
                  <span className="text-caption text-text-muted font-medium">Author</span>
                  <p className="text-small text-text-secondary mt-0.5">{detail.author}</p>
                </div>
              )}
              <div>
                <span className="text-caption text-text-muted font-medium">Source</span>
                <p className="text-small text-text-secondary mt-0.5">{detail?.source}</p>
              </div>
              <div>
                <span className="text-caption text-text-muted font-medium">Created</span>
                <p className="text-small text-text-secondary mt-0.5">{new Date(detail?.created_at ?? plugin.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-caption text-text-muted font-medium">Updated</span>
                <p className="text-small text-text-secondary mt-0.5">{new Date(detail?.updated_at ?? plugin.updated_at).toLocaleDateString()}</p>
              </div>
            </div>

            {detail?.tags && detail.tags.length > 0 && (
              <div>
                <span className="text-caption text-text-muted font-medium">Tags</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detail.tags.map(tag => (
                    <span key={tag} className="badge bg-elevated text-text-secondary">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {detail?.capabilities && detail.capabilities.length > 0 && (
              <div>
                <span className="text-caption text-text-muted font-medium">Capabilities</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detail.capabilities.map(cap => (
                    <span key={cap} className="badge bg-accent-primary/10 text-accent-primary">{cap}</span>
                  ))}
                </div>
              </div>
            )}

            {detail?.manifest?.tools && detail.manifest.tools.length > 0 && (
              <div>
                <span className="text-caption text-text-muted font-medium">Tools ({detail.manifest.tools.length})</span>
                <div className="space-y-1.5 mt-1">
                  {detail.manifest.tools.map(tool => (
                    <div key={tool.name} className="p-2 bg-surface rounded-btn">
                      <p className="text-small text-text-primary font-mono">{tool.name}</p>
                      {tool.description && <p className="text-caption text-text-secondary mt-0.5">{tool.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ratings */}
            <div className="pt-4 border-t border-border-subtle">
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption text-text-muted font-medium">Ratings</span>
                {avgRating && avgRating.count > 0 && (
                  <span className="text-caption text-text-secondary">
                    {avgRating.avg.toFixed(1)} ({avgRating.count} review{avgRating.count !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => handleRate(n)}
                    disabled={submittingRating}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-0.5"
                  >
                    <Star
                      className={cn(
                        'w-5 h-5 transition-colors',
                        n <= (hoverRating || userRating) ? 'fill-warning text-warning' : 'text-text-muted',
                      )}
                    />
                  </button>
                ))}
                {submittingRating && <Loader2 className="w-4 h-4 animate-spin text-text-muted ml-1" />}
              </div>
              {ratings.length > 0 && (
                <div className="space-y-1">
                  {ratings.slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-caption">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn('w-3 h-3', i < r.rating ? 'fill-warning text-warning' : 'text-text-muted')} />
                        ))}
                      </div>
                      <span className="text-text-muted">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tool Testing Console */}
            <div className="pt-4 border-t border-border-subtle">
              <button
                onClick={() => setShowTestConsole(!showTestConsole)}
                className="flex items-center gap-2 text-small text-text-secondary hover:text-text-primary"
              >
                <Terminal className="w-4 h-4" />
                Tool Testing Console
                <ChevronDown className={cn('w-3 h-3 transition-transform', showTestConsole && 'rotate-180')} />
              </button>
              {showTestConsole && (
                <div className="mt-3 space-y-2 p-3 bg-surface rounded-card">
                  <div>
                    <label className="text-caption text-text-muted block mb-1">Tool Name</label>
                    <input
                      value={toolName}
                      onChange={e => setToolName(e.target.value)}
                      placeholder="e.g. search_web"
                      className="input font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-caption text-text-muted block mb-1">Parameters (JSON)</label>
                    <textarea
                      value={toolParams}
                      onChange={e => setToolParams(e.target.value)}
                      rows={4}
                      className="input font-mono text-sm resize-y"
                    />
                  </div>
                  <button onClick={handleTestTool} disabled={testing} className="btn-primary flex items-center gap-1.5 text-sm">
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                    Execute
                  </button>
                  {testResult && (
                    <div>
                      <span className="text-caption text-text-muted font-medium">Result:</span>
                      <pre className="text-caption text-text-secondary mt-1 p-2 bg-void rounded-btn font-mono overflow-x-auto max-h-48 overflow-y-auto">{testResult}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
