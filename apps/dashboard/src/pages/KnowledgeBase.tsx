import { useState } from 'react';
import { BookOpen, Search, Upload, FileText, Trash2 } from 'lucide-react';

interface Document { id: string; name: string; type: string; chunks: number; chars: number; date: string }

export default function KnowledgeBase() {
  const [docs] = useState<Document[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ content: string; source: string; score: number }>>([]);

  const handleSearch = () => {
    if (!query.trim()) return;
    setResults([{ content: 'Connect to /api/v1/search/docs for real results', source: 'system', score: 1.0 }]);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-emerald-500" /> Knowledge Base</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-lg hover:bg-emerald-700"><Upload className="w-4 h-4" /> Upload Document</button>
      </div>
      <div className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search knowledge base..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
        <button onClick={handleSearch} className="px-6 py-2 bg-emerald-600 rounded-lg hover:bg-emerald-700"><Search className="w-4 h-4" /></button>
      </div>
      {results.length > 0 && (
        <div className="space-y-3">{results.map((r, i) => (
          <div key={i} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800"><p className="text-sm">{r.content}</p><p className="text-xs text-zinc-500 mt-2">Source: {r.source} | Score: {Math.round(r.score * 100)}%</p></div>
        ))}</div>
      )}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="p-4 border-b border-zinc-800"><h2 className="font-semibold">Documents ({docs.length})</h2></div>
        {docs.length === 0 ? (
          <div className="p-12 text-center text-zinc-500"><FileText className="w-12 h-12 mx-auto mb-4 opacity-20" /><p>No documents yet</p><p className="text-xs mt-1">Upload PDFs, Markdown, or text files to build your knowledge base</p></div>
        ) : (
          <div className="divide-y divide-zinc-800">{docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-zinc-800/50">
              <div><div className="font-medium">{doc.name}</div><div className="text-xs text-zinc-500">{doc.type} | {doc.chunks} chunks | {Math.round(doc.chars / 1000)}K chars</div></div>
              <button className="text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}
