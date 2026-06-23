import { useState, useRef, useCallback, useEffect } from 'react';
import { Brain, Upload, Search, Trash2, FileText, Loader2, Database, X } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface KBDocument {
  id: string;
  name: string;
  chunks: number;
  chars: number;
}

interface KBSearchResultItem {
  documentName: string;
  citation: string;
  score: number;
  content: string;
  chunkIndex: number;
}

export default function Knowledge() {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KBSearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<{ documents: number; totalChunks: number; totalChars: number } | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteName, setPasteName] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, statsRes] = await Promise.all([
        api.get<{ items: KBDocument[] }>('/knowledge/documents'),
        api.get<{ documents: number; totalChunks: number; totalChars: number }>('/knowledge/stats'),
      ]);
      setDocuments(docsRes.items);
      setStats(statsRes);
    } catch (err) {
      toast.error('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 500 * 1024) {
          toast.error(`${file.name} too large (max 500KB)`);
          continue;
        }
        const text = await file.text();
        await api.post('/knowledge/upload', { name: file.name, content: text, type: file.name.endsWith('.md') ? 'markdown' : 'text' });
        toast.success(`Uploaded: ${file.name}`);
      }
      loadDocs();
    } catch (err) {
      toast.error('Upload failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteName.trim() || !pasteContent.trim()) {
      toast.error('Name and content are required');
      return;
    }
    setUploading(true);
    try {
      await api.post('/knowledge/upload', { name: pasteName, content: pasteContent, type: 'text' });
      toast.success('Document added');
      setPasteName('');
      setPasteContent('');
      setPasteMode(false);
      loadDocs();
    } catch (err) {
      toast.error('Failed to add document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await api.delete(`/knowledge/documents/${docId}`);
      toast.success('Document deleted');
      loadDocs();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.post<{ results: KBSearchResultItem[]; total: number }>('/knowledge/search', { query: searchQuery, limit: 10 });
      setSearchResults(res.results);
      if (res.results.length === 0) toast.info('No results found');
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all documents? This cannot be undone.')) return;
    try {
      await api.delete('/knowledge/clear');
      toast.success('Knowledge base cleared');
      loadDocs();
      setSearchResults([]);
    } catch {
      toast.error('Clear failed');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="knowledge"
        icon={Database}
        title="Knowledge Base"
        subtitle="Upload documents and chat with your knowledge"
        description="The Knowledge Base lets you upload documents (PDF, TXT, MD, code files) and chat with them. Titan indexes the content using vector embeddings and uses RAG (Retrieval-Augmented Generation) to answer questions based on your documents. You can also paste text directly. Use this page to upload, manage, and query your knowledge base."
        tips={[
          'Upload PDF, TXT, Markdown, or code files — Titan will index them',
          'Use Paste Text to add content without uploading a file',
          'Once indexed, ask questions in chat: titan chat "search my knowledge base for..."',
          'Documents are chunked and embedded for semantic search',
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setPasteMode(!pasteMode)} className="btn-secondary">
              <FileText className="w-4 h-4" />
              Paste Text
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload File
          </button>
          <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept=".txt,.md,.json,.js,.ts,.py,.go,.rs,.java,.c,.cpp,.h,.css,.html,.xml,.yaml,.yml,.csv,.log" />
        </div>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-accent-primary" />
              <span className="text-small text-text-secondary">Documents</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.documents}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-accent-secondary" />
              <span className="text-small text-text-secondary">Total Chunks</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.totalChunks}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-accent-tertiary" />
              <span className="text-small text-text-secondary">Total Chars</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.totalChars.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Paste mode */}
      {pasteMode && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h3 text-text-primary">Add Document</h3>
            <button onClick={() => setPasteMode(false)} className="btn-icon"><X className="w-4 h-4" /></button>
          </div>
          <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder="Document name..." className="input" />
          <textarea value={pasteContent} onChange={(e) => setPasteContent(e.target.value)} placeholder="Paste content here..." rows={8} className="input resize-y" />
          <button onClick={handlePasteSubmit} disabled={uploading || !pasteName.trim() || !pasteContent.trim()} className="btn-primary">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Add to Knowledge Base
          </button>
        </div>
      )}

      {/* Search */}
      <div className="card p-5">
        <h3 className="text-h3 text-text-primary mb-3">Search Knowledge</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your documents..."
              className="input pl-9"
            />
          </div>
          <button onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="btn-primary">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            {searchResults.map((r, i) => (
              <div key={i} className="border border-border-subtle rounded-btn p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="badge bg-accent-primary/10 text-accent-primary text-caption">{r.documentName}</span>
                  <span className="text-caption text-text-muted">Score: {(r.score * 100).toFixed(0)}%</span>
                </div>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{r.content}</p>
                <p className="text-caption text-text-muted mt-2">{r.citation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents list */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-h3 text-text-primary">Documents</h2>
          {documents.length > 0 && (
            <button onClick={handleClearAll} className="text-small text-error hover:underline">Clear all</button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="w-10 h-10 text-text-muted mb-3" />
            <p className="text-small text-text-secondary">No documents yet. Upload files or paste text to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-elevated transition-colors">
                <FileText className="w-4 h-4 text-accent-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{doc.name}</p>
                  <p className="text-caption text-text-muted">{doc.chunks} chunks · {doc.chars.toLocaleString()} chars</p>
                </div>
                <button onClick={() => handleDelete(doc.id)} className="btn-icon shrink-0 hover:text-error" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
