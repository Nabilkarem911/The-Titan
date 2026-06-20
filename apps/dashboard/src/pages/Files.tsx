import React, { useState, useCallback } from 'react';
import {
  FolderOpen, File, ChevronRight, ArrowLeft, Upload,
  Trash2, Edit3, Save, X,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { formatBytes, formatRelativeTime } from '../utils/format';
import type { FileEntry } from '../api/client';

export default function Files() {
  const [currentPath, setCurrentPath] = useState('');
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: files, error, isLoading, refetch } = useApi<FileEntry[]>(
    () => api.listFiles(currentPath || undefined),
    [currentPath]
  );

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    setEditingFile(null);
  }, []);

  const navigateUp = useCallback(() => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
    setEditingFile(null);
  }, [currentPath]);

  const openFile = useCallback(async (file: FileEntry) => {
    if (file.type === 'directory') { navigateTo(file.path); return; }
    try {
      const result = await api.readFile(file.path);
      setEditingFile({ path: file.path, content: result.content });
    } catch (err) { /* handled by UI */ }
  }, [navigateTo]);

  const saveFile = useCallback(async () => {
    if (!editingFile) return;
    setIsSaving(true);
    try { await api.writeFile(editingFile.path, editingFile.content); } catch { /* */ }
    finally { setIsSaving(false); }
  }, [editingFile]);

  const deleteFile = useCallback(async (path: string) => {
    await api.deleteFile(path);
    refetch();
  }, [refetch]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await api.uploadFile(currentPath ? `${currentPath}/${file.name}` : file.name, file);
    refetch();
    e.target.value = '';
  }, [currentPath, refetch]);

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading && !editingFile) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigateTo('')} className="text-cyan hover:underline">root</button>
          {breadcrumbs.map((part, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="w-3 h-3 text-text-muted" />
              <button onClick={() => navigateTo(breadcrumbs.slice(0, i + 1).join('/'))} className="text-text-secondary hover:text-cyan transition-colors">{part}</button>
            </React.Fragment>
          ))}
        </div>
        <div className="flex gap-2">
          {currentPath && <button onClick={navigateUp} className="btn btn-secondary btn-sm"><ArrowLeft className="w-4 h-4" /> Back</button>}
          <label className="btn btn-secondary btn-sm cursor-pointer"><Upload className="w-4 h-4" /> Upload<input type="file" className="hidden" onChange={handleUpload} /></label>
        </div>
      </div>

      {editingFile ? (
        <div className="card flex flex-col h-[calc(100vh-14rem)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <span className="text-sm font-mono text-text-secondary">{editingFile.path}</span>
            <div className="flex gap-2">
              <button onClick={saveFile} disabled={isSaving} className="btn btn-primary btn-sm"><Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setEditingFile(null)} className="btn btn-ghost btn-sm"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <textarea
            value={editingFile.content}
            onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
            className="flex-1 w-full p-4 bg-deep text-text-primary text-sm font-mono resize-none outline-none"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="table-container">
          {!files || files.length === 0 ? (
            <EmptyState icon={<FolderOpen className="w-7 h-7 text-text-muted" />} title="Empty directory" message="No files or folders here" />
          ) : (
            <table>
              <thead><tr><th>Name</th><th>Size</th><th>Modified</th><th className="w-24">Actions</th></tr></thead>
              <tbody>
                {files.sort((a, b) => { if (a.type !== b.type) return a.type === 'directory' ? -1 : 1; return a.name.localeCompare(b.name); }).map((file) => (
                  <tr key={file.path}>
                    <td>
                      <button onClick={() => openFile(file)} className="flex items-center gap-2 text-text-primary hover:text-cyan transition-colors">
                        {file.type === 'directory' ? <FolderOpen className="w-4 h-4 text-warning" /> : <File className="w-4 h-4 text-text-muted" />}
                        <span className="text-sm">{file.name}</span>
                      </button>
                    </td>
                    <td className="text-xs font-mono">{file.size != null ? formatBytes(file.size) : '--'}</td>
                    <td className="text-xs">{file.modified ? formatRelativeTime(file.modified) : '--'}</td>
                    <td>
                      <div className="flex gap-1">
                        {file.type === 'file' && <button onClick={() => openFile(file)} className="btn btn-ghost p-1"><Edit3 className="w-3.5 h-3.5" /></button>}
                        <button onClick={() => deleteFile(file.path)} className="btn btn-ghost p-1 text-text-muted hover:text-pink"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
