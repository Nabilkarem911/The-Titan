import React, { useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames } from '../utils/format';
import type { LogEntry } from '../api/client';

const levelColors: Record<string, { badge: string; dot: string }> = {
  debug: { badge: 'badge-neutral', dot: 'bg-text-muted' },
  info: { badge: 'badge-info', dot: 'bg-cyan' },
  warn: { badge: 'badge-warning', dot: 'bg-warning' },
  error: { badge: 'badge-error', dot: 'bg-pink' },
};

export default function Logs() {
  const [level, setLevel] = useState('');
  const [source, setSource] = useState('');
  const { data: logs, error, isLoading, refetch } = useApi<LogEntry[]>(
    () => api.getLogs({ level: level || undefined, source: source || undefined, limit: 200 }),
    [level, source]
  );

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="input w-36">
          <option value="">All Levels</option><option value="debug">Debug</option><option value="info">Info</option><option value="warn">Warn</option><option value="error">Error</option>
        </select>
        <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Filter by source..." className="input w-48" />
        <button onClick={refetch} className="btn btn-secondary btn-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      {!logs || logs.length === 0 ? (
        <EmptyState icon={<ScrollText className="w-7 h-7 text-text-muted" />} title="No logs" message="Log entries will appear here" />
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border max-h-[calc(100vh-14rem)] overflow-y-auto">
            {logs.map((log) => {
              const colors = levelColors[log.level] || levelColors.info;
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-card-hover transition-colors">
                  <div className={classNames('w-2 h-2 rounded-full mt-1.5 shrink-0', colors.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={classNames('badge text-[10px]', colors.badge)}>{log.level}</span>
                      <span className="text-xs font-mono text-text-muted">{log.source}</span>
                      <span className="text-xs text-text-muted ms-auto">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5 break-words">{log.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
