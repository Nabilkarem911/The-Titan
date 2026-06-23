import { useState, useEffect, useCallback } from 'react';
import { Moon, Brain, Sparkles, Loader2, Play, Square, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface DreamStats {
  totalDreams: number;
  totalInsights: number;
  isDreaming: boolean;
  isRunning: boolean;
  avgInsightsPerDream: number;
}

interface DreamInsight {
  id: string;
  type: 'pattern' | 'preference' | 'stale_fact' | 'skill_gap' | 'optimization';
  content: string;
  confidence: number;
  basedOnRuns: number;
  createdAt: string;
  action?: string;
}

interface DreamReport {
  dreamId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  experiencesReviewed: number;
  insights: DreamInsight[];
  memoriesConsolidated: number;
  staleFactsUpdated: number;
}

export default function DreamLab() {
  const [stats, setStats] = useState<DreamStats | null>(null);
  const [insights, setInsights] = useState<DreamInsight[]>([]);
  const [reports, setReports] = useState<DreamReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, insightsRes, reportsRes] = await Promise.all([
        api.get<DreamStats>('/dream/stats'),
        api.get<{ insights: DreamInsight[] }>('/dream/insights'),
        api.get<{ reports: DreamReport[] }>('/dream/reports'),
      ]);
      setStats(statsRes);
      setInsights(insightsRes.insights ?? []);
      setReports(reportsRes.reports ?? []);
    } catch {
      toast.error('Failed to load dream data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await api.post('/dream/trigger', {});
      toast.success('Dream session triggered');
      await load();
    } catch {
      toast.error('Failed to trigger dream');
    } finally {
      setTriggering(false);
    }
  };

  const handleStart = async () => {
    try {
      await api.post('/dream/start', {});
      toast.success('Dream mode started');
      await load();
    } catch {
      toast.error('Failed to start dream mode');
    }
  };

  const handleStop = async () => {
    try {
      await api.post('/dream/stop', {});
      toast.success('Dream mode stopped');
      await load();
    } catch {
      toast.error('Failed to stop dream mode');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="dreamLab"
        icon={Moon}
        title="Dream Lab"
        subtitle="Memory consolidation, insight extraction, and dream mode control"
        description="Dream Mode is Titan's offline memory consolidation system. When activated, Titan reviews past experiences, extracts patterns and insights, updates stale facts, and strengthens important memories — similar to how humans consolidate memories during sleep. Use this page to start/stop dream sessions, view extracted insights, and browse dream reports."
        tips={[
          'Start a dream session to let Titan consolidate recent experiences into insights',
          'Insights are categorized as: patterns, preferences, stale facts, skill gaps, and optimizations',
          'You can also trigger a single dream from chat: titan chat "start dreaming"',
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-ghost flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          {stats?.isRunning ? (
            <button onClick={handleStop} className="btn-secondary flex items-center gap-2">
              <Square className="w-4 h-4" /> Stop
            </button>
          ) : (
            <button onClick={handleStart} className="btn-secondary flex items-center gap-2">
              <Play className="w-4 h-4" /> Start
            </button>
          )}
          <button onClick={handleTrigger} disabled={triggering} className="btn-primary flex items-center gap-2">
            {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Trigger Dream
          </button>
        </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="w-4 h-4 text-accent-primary" />
              <span className="text-small text-text-secondary">Total Dreams</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.totalDreams}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-accent-secondary" />
              <span className="text-small text-text-secondary">Total Insights</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.totalInsights}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent-tertiary" />
              <span className="text-small text-text-secondary">Avg Insights/Dream</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.avgInsightsPerDream}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${stats.isDreaming ? 'bg-warning animate-pulse' : 'bg-text-muted'}`} />
              <span className="text-small text-text-secondary">Status</span>
            </div>
            <p className="text-sm font-medium text-text-primary">
              {stats.isDreaming ? 'Dreaming...' : stats.isRunning ? 'Idle (running)' : 'Stopped'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary flex items-center gap-2">
              <Brain className="w-4 h-4 text-accent-primary" />
              Insights ({insights.length})
            </h2>
          </div>
          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Moon className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No insights yet — trigger a dream to generate</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle max-h-96 overflow-y-auto">
              {insights.map((insight) => (
                <div key={insight.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge bg-accent-primary/10 text-accent-primary text-caption">{insight.type}</span>
                    <span className="text-caption text-text-muted">{insight.confidence}% confidence</span>
                  </div>
                  <p className="text-sm text-text-primary">{insight.content}</p>
                  {insight.action && <p className="text-caption text-text-secondary mt-1">→ {insight.action}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary flex items-center gap-2">
              <Moon className="w-4 h-4 text-accent-secondary" />
              Dream Reports ({reports.length})
            </h2>
          </div>
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Moon className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No dream reports yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle max-h-96 overflow-y-auto">
              {reports.map((report) => (
                <div key={report.dreamId} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">Dream {report.dreamId}</span>
                    <span className="text-caption text-text-muted">{(report.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="flex items-center gap-4 text-caption text-text-secondary">
                    <span>{report.experiencesReviewed} experiences</span>
                    <span>{report.insights.length} insights</span>
                    <span>{report.memoriesConsolidated} consolidated</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
