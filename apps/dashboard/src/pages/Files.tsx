import { useState } from 'react';
import { FolderOpen, Upload, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonTable } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';
import { formatBytes, getFileIcon } from '../utils/format';

export default function Files() {
  const [currentPath, setCurrentPath] = useState('/');
  const { data, loading, error, refetch } = useApi(() => api.listFiles(currentPath), [currentPath]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.uploadFile(currentPath, file);
      refetch();
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleDelete = async (name: string) => {
    const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    try {
      await api.deleteFile(fullPath);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const navigateTo = (name: string) => {
    setCurrentPath(currentPath === '/' ? `/${name}` : `${currentPath}/${name}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10">
            <FolderOpen className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Files</h2>
            <p className="text-sm text-slate-400">Browse and manage workspace files</p>
          </div>
        </div>
        <label className="btn-primary text-sm cursor-pointer">
          <Upload className="h-4 w-4" />
          Upload
          <input type="file" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-slate-400">
        <button onClick={() => setCurrentPath('/')} className="hover:text-white">root</button>
        {currentPath !== '/' &&
          currentPath.split('/').filter(Boolean).map((part, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              <span>/</span>
              <button
                onClick={() => setCurrentPath('/' + arr.slice(0, i + 1).join('/'))}
                className="hover:text-white"
              >
                {part}
              </button>
            </span>
          ))}
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={8} cols={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6 text-slate-400" />}
          title="Empty directory"
          description="Upload files or navigate to a different directory."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Size</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Modified</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => item.type === 'directory' ? navigateTo(item.name) : undefined}
                      className={`flex items-center gap-2 ${item.type === 'directory' ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-300'}`}
                    >
                      {getFileIcon(item.name)}
                      {item.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {item.type === 'directory' ? '--' : formatBytes(item.size)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(item.modified).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(item.name)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
