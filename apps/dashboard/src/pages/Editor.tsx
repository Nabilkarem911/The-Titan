import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  Save,
  FolderOpen,
  ArrowLeft,
  FileCode,
  RefreshCw,
  ChevronRight,
  Download,
  Minimize2,
} from 'lucide-react';

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

import { API_BASE, getToken } from '../api/client';
import { getFileIcon } from '../utils/format';

export default function CodeEditor() {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('plaintext');
  const [_loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/files?path=${encodeURIComponent(currentPath)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: FileEntry[] };
      setEntries(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    }
  }, [currentPath]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    setUnsaved(fileContent !== originalContent);
  }, [fileContent, originalContent]);

  const navigateTo = (name: string) => {
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length === 0 ? '/' : '/' + parts.join('/'));
  };

  const loadFile = async (name: string) => {
    setLoading(true);
    setError(null);
    const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    try {
      const res = await fetch(`${API_BASE}/files/content?path=${encodeURIComponent(filePath)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json() as { content: string };
      setFileContent(data.content);
      setOriginalContent(data.content);
      setOpenFile(name);
      setUnsaved(false);

      // Detect language
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
        py: 'python', go: 'go', rs: 'rust', java: 'java', cpp: 'cpp', c: 'c',
        html: 'html', css: 'css', json: 'json', md: 'markdown', sql: 'sql',
        yaml: 'yaml', yml: 'yaml', toml: 'toml', sh: 'shell', dockerfile: 'dockerfile',
      };
      setEditorLanguage(langMap[ext] ?? 'plaintext');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!openFile) return;
    const filePath = currentPath === '/' ? `/${openFile}` : `${currentPath}/${openFile}`;
    try {
      const res = await fetch(`${API_BASE}/files/content`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath, content: fileContent }),
      });
      if (!res.ok) throw new Error('Save failed');
      setOriginalContent(fileContent);
      setUnsaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleDownload = async () => {
    if (!openFile) return;
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = openFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditorMount = (editorInstance: editor.IStandaloneCodeEditor) => {
    editorRef.current = editorInstance;
    editorInstance.addCommand(2048 | 49 /* Ctrl+S / Cmd+S */, () => {
      handleSave();
      return false;
    });
  };

  const breadcrumbs = currentPath === '/' ? ['workspace'] : ['workspace', ...currentPath.split('/').filter(Boolean)];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {currentPath !== '/' && (
            <button onClick={navigateUp} className="btn-secondary">
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="btn-secondary">
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="flex items-center gap-1">
                {idx > 0 && <span>/</span>}
                <button
                  onClick={() => {
                    if (idx === 0) setCurrentPath('/');
                    else setCurrentPath('/' + breadcrumbs.slice(1, idx + 1).join('/'));
                  }}
                  className="hover:text-indigo-400 transition-colors"
                >
                  {crumb}
                </button>
              </span>
            ))}
          </div>
        </div>

        {openFile && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${unsaved ? 'text-amber-400' : 'text-emerald-400'}`}>
              {unsaved ? 'Unsaved changes' : 'Saved'}
            </span>
            <button onClick={handleSave} disabled={!unsaved} className="btn-primary">
              <Save className="h-4 w-4" />
              Save
            </button>
            <button onClick={handleDownload} className="btn-secondary">
              <Download className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Editor + Sidebar */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* File Tree */}
        {!sidebarCollapsed && (
          <div className="card p-3 w-56 flex-shrink-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/50">
              <FolderOpen className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-slate-200">Explorer</span>
              <button onClick={fetchFiles} className="ml-auto text-slate-500 hover:text-white transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 -mx-1 space-y-0.5">
              {entries
                .sort((a, b) => {
                  if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map((entry) => (
                  <button
                    key={entry.name}
                    onClick={() => entry.type === 'directory' ? navigateTo(entry.name) : loadFile(entry.name)}
                    className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                      entry.type === 'directory'
                        ? 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        : openFile === entry.name
                          ? 'bg-indigo-500/15 text-indigo-400'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    {entry.type === 'directory' ? (
                      <FolderOpen className="h-4 w-4 text-amber-400" />
                    ) : (
                      getFileIcon(entry.name, 'h-4 w-4')
                    )}
                    <span className="truncate">{entry.name}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="card p-0 flex-1 flex flex-col overflow-hidden">
          {openFile ? (
            <>
              <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800/50 bg-slate-900/30">
                <FileCode className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-medium text-slate-200">{openFile}</span>
                <span className="text-xs text-slate-500">{editorLanguage}</span>
                {unsaved && (
                  <span className="text-xs text-amber-400 ml-auto">● modified</span>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={editorLanguage}
                  value={fileContent}
                  theme="vs-dark"
                  onChange={(val) => setFileContent(val ?? '')}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: 'JetBrains Mono, Fira Code, monospace',
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                    tabSize: 2,
                    padding: { top: 16 },
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
              <FileCode className="h-12 w-12 text-slate-700" />
              <p className="text-sm">Select a file from the explorer to edit</p>
              <p className="text-xs text-slate-600">or navigate to a directory</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
