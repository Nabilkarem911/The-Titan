import { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  Upload,
  Download,
  Trash2,
  FileCode,
  ChevronRight,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import type { FileEntry } from '../api/types';
import { EmptyState } from '../components/PageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { formatBytes } from '../utils/format';
import { cn } from '../utils/cn';

export default function Files() {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);

  const loadDir = useCallback(async (path: string) => {
    setIsLoading(true);
    setSelectedFile(null);
    try {
      const data = await api.get<{ items: FileEntry[] }>(`/files?path=${encodeURIComponent(path)}`);
      setEntries(data.items);
      setCurrentPath(path);
    } catch (err) {
      toast.error('Failed to load directory', { description: err instanceof Error ? err.message : undefined });
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDir('/'); }, [loadDir]);

  const handleFileClick = async (entry: FileEntry) => {
    if (entry.type === 'directory') {
      const newPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
      loadDir(newPath);
    } else {
      setFileLoading(true);
      const filePath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
      try {
        const data = await api.get<{ content: string; path: string }>(`/files/content?path=${encodeURIComponent(filePath)}`);
        setSelectedFile({ path: filePath, content: data.content });
        setEditedContent(data.content);
      } catch (err) {
        toast.error('Failed to open file', { description: err instanceof Error ? err.message : undefined });
      } finally {
        setFileLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    try {
      await api.put('/files/content', { path: selectedFile.path, content: editedContent });
      toast.success('File saved');
    } catch (err) {
      toast.error('Failed to save', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDelete = async (entry: FileEntry) => {
    if (!confirm(`Delete ${entry.name}?`)) return;
    const path = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    try {
      await api.delete(`/files?path=${encodeURIComponent(path)}`);
      toast.success('Deleted');
      loadDir(currentPath);
    } catch (err) {
      toast.error('Failed to delete', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDownload = (entry: FileEntry) => {
    const path = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    const token = localStorage.getItem('titan_access_token');
    const url = `/api/v1/files/download?path=${encodeURIComponent(path)}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = entry.name;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Download failed'));
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex h-full">
      {/* File Explorer */}
      <div className={cn('flex flex-col border-r border-border-subtle', selectedFile ? 'w-64 shrink-0' : 'flex-1')}>
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-h3 text-text-primary">Files</h1>
            <label className="btn-icon cursor-pointer" title="Upload">
              <Upload className="w-4 h-4" />
              <input type="file" multiple className="hidden" onChange={async (e) => {
                const files = e.target.files;
                if (!files?.length) return;
                const formData = new FormData();
                formData.append('path', currentPath);
                Array.from(files).forEach(f => formData.append('files', f));
                try {
                  await api.upload('/files/upload', formData);
                  toast.success(`Uploaded ${files.length} file(s)`);
                  loadDir(currentPath);
                } catch (err) {
                  toast.error('Upload failed', { description: err instanceof Error ? err.message : undefined });
                }
              }} />
            </label>
          </div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-caption text-text-muted overflow-x-auto">
            <button onClick={() => loadDir('/')} className="hover:text-text-primary">root</button>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3" />
                <button
                  onClick={() => loadDir('/' + breadcrumbs.slice(0, i + 1).join('/'))}
                  className="hover:text-text-primary whitespace-nowrap"
                >
                  {crumb}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState icon={Folder} title="Empty directory" description="No files or folders here" className="py-12" />
          ) : (
            <div className="py-1">
              {currentPath !== '/' && (
                <button
                  onClick={() => loadDir('/' + breadcrumbs.slice(0, -1).join('/'))}
                  className="flex items-center gap-2 px-4 py-2 w-full text-sm text-text-secondary hover:bg-elevated/30 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              {entries.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-elevated/30 transition-colors group cursor-pointer"
                  onClick={() => handleFileClick(entry)}
                >
                  {entry.type === 'directory' ? (
                    <Folder className="w-4 h-4 text-accent-primary shrink-0" />
                  ) : (
                    <FileCode className="w-4 h-4 text-text-muted shrink-0" />
                  )}
                  <span className="text-sm text-text-primary truncate flex-1">{entry.name}</span>
                  <span className="text-caption text-text-muted tabular-nums">{formatBytes(entry.size)}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(entry); }}
                      className="btn-icon !w-6 !h-6"
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}
                      className="btn-icon !w-6 !h-6 text-error hover:text-error"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File Editor */}
      {selectedFile && (
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-sm font-mono text-text-primary">{selectedFile.path}</span>
            <button onClick={handleSave} className="btn-primary !py-1.5">
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="flex-1 bg-void text-text-primary font-mono text-sm p-4 resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>
      )}
      {fileLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
