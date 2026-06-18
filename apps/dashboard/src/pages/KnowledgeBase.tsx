import { useState, useEffect } from 'react';
import { Library, Search, Upload, FileText, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { EmptyState } from '../components/PageState';

interface Document {
  id: string;
  name: string;
  type: string;
  chunks: number;
  chars: number;
  date: string;
}

interface SearchResult {
  content: string;
  source: string;
  score: number;
}

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/knowledge/documents`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { items?: Document[] };
      setDocs(d.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/knowledge/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { results?: SearchResult[] };
      setResults(d.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      const res = await fetch(`${API_BASE}/knowledge/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      setDocs(docs.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400">
            <Library className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Knowledge Base</h3>
            <p className="text-xs text-slate-500">Upload and search documents for RAG</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDocs} className="btn-secondary" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button className="btn-primary"><Upload className="h-4 w-4" /> Upload</button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search knowledge base..."
          className="input flex-1"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={searching || !query.trim()} className="btn-primary">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-white">Search Results</h4>
          {results.map((r, i) => (
            <div key={i} className="card">
              <p className="text-sm text-slate-300">{r.content}</p>
              <p className="text-xs text-slate-500 mt-2">Source: {r.source} | Score: {Math.round(r.score * 100)}%</p>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h4 className="text-sm font-medium text-white mb-4">Documents ({docs.length})</h4>
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-slate-800/50 rounded-lg" />)}
          </div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6 text-slate-400" />}
            title="No documents yet"
            description="Upload PDFs, Markdown, or text files to build your knowledge base"
          />
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
                <div>
                  <div className="text-sm font-medium text-slate-200">{doc.name}</div>
                  <div className="text-xs text-slate-500">{doc.type} | {doc.chunks} chunks | {Math.round(doc.chars / 1000)}K chars</div>
                </div>
                <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10" aria-label={`Delete ${doc.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
