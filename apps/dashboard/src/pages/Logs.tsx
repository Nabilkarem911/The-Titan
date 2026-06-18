import { useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonTable } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function Logs() {
  const [level, setLevel] = useState('');
  const { data, loading, error, refetch } = useApi(
    () => api.getLogs({ limit: 50, level: level || undefined }),
    [level],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/10">
            <ScrollText className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Logs</h2>
            <p className="text-sm text-slate-400">View system and application logs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="input text-sm">
            <option value="">All levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
          <button onClick={refetch} className="btn-secondary text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={10} cols={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6 text-slate-400" />}
          title="No logs"
          description="No log entries found for the selected filter."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Level</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {log.timestamp ? new Date(String(log.timestamp)).toLocaleString() : '--'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      log.level === 'error' ? 'badge-error' :
                      log.level === 'warn' ? 'badge-warning' :
                      log.level === 'info' ? 'badge-info' : 'badge-success'
                    }`}>
                      {String(log.level ?? 'info')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 truncate max-w-md">
                    {String(log.message ?? '')}
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
