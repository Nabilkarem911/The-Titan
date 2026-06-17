import { useState, useEffect, useCallback } from 'react';
// Titan Dashboard — File Manager v1
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FolderPlus,
  ArrowLeft,
  Archive,
  RefreshCw,
} from 'lucide-react';

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

import { API_BASE, getToken } from '../api/client';
import { formatBytes, getFileIcon } from '../utils/format';

export default function Files() {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/files?path=${encodeURIComponent(currentPath)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json() as { items: FileEntry[] };
      setEntries(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('path', currentPath);
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (name: string, type: 'file' | 'directory') => {
    const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    const endpoint = type === 'directory' ? '/files/download-zip' : '/files/download';
    const res = await fetch(`${API_BASE}${endpoint}?path=${encodeURIComponent(filePath)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'directory' ? `${name}.zip` : name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    try {
      const res = await fetch(`${API_BASE}/files?path=${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folderPath = currentPath === '/' ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
    try {
      const res = await fetch(`${API_BASE}/files/mkdir`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: folderPath }),
      });
      if (!res.ok) throw new Error('Failed to create folder');
      setNewFolderName('');
      setShowNewFolder(false);
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleDownloadZip = async () => {
    const res = await fetch(`${API_BASE}/files/download-zip?path=${encodeURIComponent(currentPath)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workspace.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const breadcrumbs = currentPath === '/' ? ['workspace'] : ['workspace', ...currentPath.split('/').filter(Boolean)];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <span className="text-slate-600">/</span>}
            <button
              onClick={() => {
                if (idx === 0) setCurrentPath('/');
                else setCurrentPath('/' + breadcrumbs.slice(1, idx + 1).join('/'));
              }}
              className={`hover:text-indigo-400 transition-colors ${
                idx === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-slate-400'
              }`}
            >
              {crumb}
            </button>
          </span>
        ))}
      </nav>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {currentPath !== '/' && (
          <button onClick={navigateUp} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        <label className="btn-primary cursor-pointer">
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload'}
          <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        <button onClick={() => setShowNewFolder(true)} className="btn-secondary">
          <FolderPlus className="h-4 w-4" />
          New Folder
        </button>
        <button onClick={handleDownloadZip} className="btn-secondary">
          <Archive className="h-4 w-4" />
          Download ZIP
        </button>
        <button onClick={fetchFiles} className="btn-secondary" aria-label="Refresh file list">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* New Folder Input */}
      {showNewFolder && (
        <div className="flex items-center gap-3 p-4 card">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            placeholder="Folder name..."
            className="input flex-1"
            autoFocus
            aria-label="New folder name"
          />
          <button onClick={handleCreateFolder} className="btn-primary">Create</button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="btn-secondary">Cancel</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      {/* File List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <FolderOpen className="h-12 w-12 mb-3 text-slate-600" />
            <p className="text-sm">This directory is empty</p>
            <p className="text-xs text-slate-600 mt-1">Upload files or create a folder to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Size</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Modified</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {entries
                .sort((a, b) => {
                  if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map((entry) => (
                  <tr key={entry.name} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => entry.type === 'directory' ? navigateTo(entry.name) : undefined}
                        className={`flex items-center gap-3 ${entry.type === 'directory' ? 'cursor-pointer hover:text-indigo-400' : 'cursor-default'} transition-colors`}
                      >
                        {entry.type === 'directory' ? (
                          <FolderOpen className="h-5 w-5 text-amber-400" />
                        ) : (
                          getFileIcon(entry.name)
                        )}
                        <span className="text-sm text-slate-200 group-hover:text-white">{entry.name}</span>
                      </button>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-400 hidden sm:table-cell">
                      {entry.type === 'file' ? formatBytes(entry.size) : '--'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500 hidden md:table-cell">
                      {entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleDateString() : '--'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownload(entry.name, entry.type)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                          title="Download"
                          aria-label={`Download ${entry.name}`}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                          aria-label={`Delete ${entry.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
