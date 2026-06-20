import { useState, useEffect, useCallback } from 'react';
import { Search, FolderTree, Box, Loader2, Database, FileCode } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

interface IndexStats {
  indexed: boolean;
  rootDir?: string;
  stats?: {
    totalFiles: number;
    totalLines: number;
    totalSymbols: number;
    byExtension: Record<string, number>;
  };
  indexedAt?: string;
}

interface SymbolResult {
  name: string;
  kind: string;
  filePath: string;
  line: number;
  exported: boolean;
  signature?: string;
}

interface FileResult {
  relativePath: string;
  extension: string;
  lines: number;
  size: number;
}

const SYMBOL_COLORS: Record<string, string> = {
  function: 'text-accent-primary',
  class: 'text-accent-secondary',
  interface: 'text-accent-tertiary',
  type: 'text-warning',
  enum: 'text-success',
  variable: 'text-text-muted',
  export: 'text-accent-primary',
  import: 'text-text-muted',
};

export default function CodeIntel() {
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [rootDir, setRootDir] = useState('.');
  const [searchType, setSearchType] = useState<'symbols' | 'files'>('symbols');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolResult[] | FileResult[]>([]);
  const [searching, setSearching] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<IndexStats>('/codeintel/stats');
      setStats(res);
    } catch {
      toast.error('Failed to load code intel stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleIndex = async () => {
    setIndexing(true);
    try {
      const res = await api.post<IndexStats>('/codeintel/index', { rootDir });
      setStats(res);
      toast.success(`Indexed ${res.stats?.totalFiles || 0} files, ${res.stats?.totalSymbols || 0} symbols`);
    } catch (err) {
      toast.error('Indexing failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIndexing(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const endpoint = searchType === 'symbols' ? '/codeintel/search/symbols' : '/codeintel/search/files';
      const res = await api.post<{ results: SymbolResult[] | FileResult[]; total: number }>(endpoint, { query, limit: 50 });
      setResults(res.results);
      if (res.results.length === 0) toast.info('No results found');
    } catch {
      toast.error('Search failed — index a directory first');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-h1 text-text-primary">Code Intelligence</h1>
        <p className="text-small text-text-secondary mt-1">Index, search, and analyze your codebase</p>
      </div>

      {/* Index section */}
      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-3 flex items-center gap-2">
          <Database className="w-4 h-4 text-accent-primary" />
          Codebase Index
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={rootDir}
            onChange={(e) => setRootDir(e.target.value)}
            placeholder="Directory path (e.g. /app, ./src)"
            className="input flex-1"
          />
          <button onClick={handleIndex} disabled={indexing} className="btn-primary">
            {indexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {indexing ? 'Indexing...' : 'Index'}
          </button>
        </div>

        {stats?.indexed && stats.stats && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 rounded-btn bg-elevated">
              <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.stats.totalFiles}</p>
              <p className="text-caption text-text-muted">Files</p>
            </div>
            <div className="text-center p-3 rounded-btn bg-elevated">
              <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.stats.totalLines.toLocaleString()}</p>
              <p className="text-caption text-text-muted">Lines</p>
            </div>
            <div className="text-center p-3 rounded-btn bg-elevated">
              <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.stats.totalSymbols}</p>
              <p className="text-caption text-text-muted">Symbols</p>
            </div>
          </div>
        )}

        {stats?.indexed && stats.stats?.byExtension && (
          <div className="mt-3">
            <p className="text-caption text-text-secondary mb-2">By extension:</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.stats.byExtension)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15)
                .map(([ext, count]) => (
                  <span key={ext} className="badge bg-elevated text-text-secondary text-caption">
                    {ext} · {count}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Search section */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h3 text-text-primary flex items-center gap-2">
            <Search className="w-4 h-4 text-accent-secondary" />
            Search
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchType('symbols')}
              className={cn('btn-secondary text-caption py-1 px-2', searchType === 'symbols' && '!bg-accent-primary/10 !border-accent-primary')}
            >
              <Box className="w-3 h-3 inline mr-1" />
              Symbols
            </button>
            <button
              onClick={() => setSearchType('files')}
              className={cn('btn-secondary text-caption py-1 px-2', searchType === 'files' && '!bg-accent-primary/10 !border-accent-primary')}
            >
              <FolderTree className="w-3 h-3 inline mr-1" />
              Files
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={searchType === 'symbols' ? 'Search symbols (e.g. handleSend)...' : 'Search files (e.g. Chat.tsx)...'}
              className="input pl-9"
            />
          </div>
          <button onClick={handleSearch} disabled={searching || !query.trim()} className="btn-primary">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchType === 'symbols' && (results as SymbolResult[]).map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-btn border border-border-subtle hover:bg-elevated transition-colors">
                <span className={cn('text-sm font-mono font-medium', SYMBOL_COLORS[s.kind] || 'text-text-primary')}>
                  {s.name}
                </span>
                <span className="badge bg-elevated text-text-muted text-caption">{s.kind}</span>
                {s.exported && <span className="badge bg-accent-primary/10 text-accent-primary text-caption">exported</span>}
                <span className="text-caption text-text-muted ml-auto">{s.filePath}:{s.line}</span>
              </div>
            ))}
            {searchType === 'files' && (results as FileResult[]).map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-btn border border-border-subtle hover:bg-elevated transition-colors">
                <FileCode className="w-4 h-4 text-accent-secondary shrink-0" />
                <span className="text-sm font-mono text-text-primary">{f.relativePath}</span>
                <span className="text-caption text-text-muted ml-auto">{f.lines} lines · {(f.size / 1024).toFixed(1)}KB</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        </div>
      )}
    </div>
  );
}
