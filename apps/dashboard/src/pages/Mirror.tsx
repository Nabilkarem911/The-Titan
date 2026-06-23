import { useState, useEffect, useCallback } from 'react';
import { Brain, MessageCircle, Eye, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface MirrorStats {
  threads: Array<{ id: string; type: string; content: string; priority: number; active: boolean }>;
  threadCount: number;
  lastNarrative: string | null;
  selfModel: Record<string, unknown> | null;
  episodicItems: Array<{ id: string; type: string; content: string; salience: number }>;
  episodicSize: number;
  episodicCapacity: number;
}

export default function Mirror() {
  const [stats, setStats] = useState<MirrorStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<MirrorStats>('/mirror/stats');
      setStats(res);
    } catch {
      toast.error('Failed to load MIRROR data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <Brain className="w-6 h-6 text-accent-primary" />
            MIRROR
          </h1>
          <p className="text-small text-text-secondary mt-1">Inner monologue, cognitive control, episodic buffer, digital twin, and normative agency</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-accent-primary" />
              Inner Monologue ({stats?.threadCount ?? 0})
            </h2>
          </div>
          {stats?.threads && stats.threads.length > 0 ? (
            <div className="divide-y divide-border-subtle max-h-80 overflow-y-auto">
              {stats.threads.map((t) => (
                <div key={t.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge bg-accent-primary/10 text-accent-primary text-caption">{t.type}</span>
                    <span className="text-caption text-text-muted">Priority: {t.priority}</span>
                  </div>
                  <p className="text-sm text-text-primary">{t.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No active cognitive threads</p>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary flex items-center gap-2">
              <Eye className="w-4 h-4 text-accent-secondary" />
              Episodic Buffer ({stats?.episodicSize ?? 0}/{stats?.episodicCapacity ?? 0})
            </h2>
          </div>
          {stats?.episodicItems && stats.episodicItems.length > 0 ? (
            <div className="divide-y divide-border-subtle max-h-80 overflow-y-auto">
              {stats.episodicItems.map((item) => (
                <div key={item.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge bg-accent-secondary/10 text-accent-secondary text-caption">{item.type}</span>
                    <span className="text-caption text-text-muted">Salience: {item.salience.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-text-primary">{item.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Eye className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">Episodic buffer is empty</p>
            </div>
          )}
        </div>
      </div>

      {stats?.lastNarrative && (
        <div className="card p-5">
          <h2 className="text-h3 text-text-primary mb-3">Last Narrative Synthesis</h2>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{stats.lastNarrative}</p>
        </div>
      )}

      {stats?.selfModel && (
        <div className="card p-5">
          <h2 className="text-h3 text-text-primary mb-3">Self Model</h2>
          <pre className="text-small text-text-secondary overflow-x-auto">{JSON.stringify(stats.selfModel, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
