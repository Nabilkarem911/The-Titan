import { useState, useEffect } from 'react';
import {
  FolderOpen,
  FileCode,
  GitBranch,
  Clock,
  HardDrive,
  RefreshCw,
  ChevronRight,
  Terminal,
  Settings,
} from 'lucide-react';

interface ProjectStats {
  totalFiles: number;
  totalDirs: number;
  lastModified: string;
  sizeBytes: number;
}

interface RecentFile {
  name: string;
  path: string;
  modifiedAt: string;
  size: number;
}

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? '/api/v1';
const getToken = () => localStorage.getItem('titan_access_token') ?? '';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export default function ProjectsPage() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/files?path=/`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: Array<{ name: string; type: 'file' | 'directory'; size: number; modifiedAt: string }> };
      const items = data.items ?? [];

      const files = items.filter((i) => i.type === 'file');
      const dirs = items.filter((i) => i.type === 'directory');
      const totalSize = items.reduce((sum, i) => sum + (i.size ?? 0), 0);
      const lastMod = items.length > 0
        ? new Date(Math.max(...items.map((i) => new Date(i.modifiedAt).getTime()))).toISOString()
        : new Date().toISOString();

      setStats({
        totalFiles: files.length,
        totalDirs: dirs.length,
        lastModified: lastMod,
        sizeBytes: totalSize,
      });

      setRecentFiles(
        items
          .filter((i) => i.type === 'file')
          .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
          .slice(0, 10)
          .map((i) => ({ name: i.name, path: `/${i.name}`, modifiedAt: i.modifiedAt, size: i.size })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Workspace Overview</h3>
            <p className="text-xs text-slate-500">Project files, stats, and quick access</p>
          </div>
        </div>
        <button onClick={fetchWorkspace} className="btn-secondary">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<FileCode className="h-5 w-5 text-blue-400" />}
          label="Files"
          value={stats?.totalFiles ?? 0}
          loading={loading}
        />
        <StatCard
          icon={<FolderOpen className="h-5 w-5 text-amber-400" />}
          label="Directories"
          value={stats?.totalDirs ?? 0}
          loading={loading}
        />
        <StatCard
          icon={<HardDrive className="h-5 w-5 text-emerald-400" />}
          label="Total Size"
          value={stats ? formatBytes(stats.sizeBytes) : '—'}
          loading={loading}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-purple-400" />}
          label="Last Modified"
          value={stats ? new Date(stats.lastModified).toLocaleDateString() : '—'}
          loading={loading}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction to="/editor" icon={<FileCode className="h-5 w-5" />} label="Open Editor" />
        <QuickAction to="/terminal" icon={<Terminal className="h-5 w-5" />} label="Open Terminal" />
        <QuickAction to="/git" icon={<GitBranch className="h-5 w-5" />} label="Git Push" />
        <QuickAction to="/settings" icon={<Settings className="h-5 w-5" />} label="Settings" />
      </div>

      {/* Recent Files */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/50 flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">Recent Files</h4>
          <span className="text-xs text-slate-500">{recentFiles.length} files</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <FileCode className="h-10 w-10 mb-2 text-slate-600" />
            <p className="text-sm">No files yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/30">
            {recentFiles.map((file) => (
              <a
                key={file.path}
                href={`/editor?file=${encodeURIComponent(file.path)}`}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-800/30 transition-colors group"
              >
                <FileCode className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <span className="text-sm text-slate-300 flex-1 truncate">{file.name}</span>
                <span className="text-xs text-slate-500 hidden sm:inline">{formatBytes(file.size)}</span>
                <span className="text-xs text-slate-500 hidden md:inline">
                  {new Date(file.modifiedAt).toLocaleString()}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: string | number; loading: boolean }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="flex-shrink-0 p-2 rounded-lg bg-slate-800/60">{icon}</div>
      <div>
        <div className="text-lg font-semibold text-white">
          {loading ? <span className="inline-block w-6 h-4 bg-slate-700/50 rounded animate-pulse" /> : value}
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={to}
      className="card p-3 flex flex-col items-center gap-2 text-center hover:bg-slate-800/60 transition-colors group"
    >
      <div className="p-2 rounded-lg bg-slate-800/60 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
        {icon}
      </div>
      <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{label}</span>
    </a>
  );
}
