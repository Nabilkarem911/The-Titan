import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, RefreshCw, Wrench, Code2, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface EvolutionStats {
  totalEvolutions: number;
  appliedEvolutions: number;
  rolledBackEvolutions: number;
  totalABTests: number;
  appliedTransfers: number;
}

interface SelfRewriteStats {
  totalVersions: number;
  currentVersion: number;
  currentPerformance: number;
  appliedCount: number;
  rolledBackCount: number;
  improvementRate: number;
}

interface DebuggerStats {
  totalLessons: number;
  totalAttempts: number;
  successRate: number;
}

export default function Evolution() {
  const [evoStats, setEvoStats] = useState<EvolutionStats | null>(null);
  const [rewriteStats, setRewriteStats] = useState<SelfRewriteStats | null>(null);
  const [debugStats, setDebugStats] = useState<DebuggerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evo, rewrite, debug] = await Promise.all([
        api.get<EvolutionStats>('/evolution/stats').catch(() => null),
        api.get<SelfRewriteStats>('/self-rewrite/stats').catch(() => null),
        api.get<DebuggerStats>('/debug/stats').catch(() => null),
      ]);
      setEvoStats(evo);
      setRewriteStats(rewrite);
      setDebugStats(debug);
    } catch {
      toast.error('Failed to load evolution data');
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
      <PageHeader
        icon={Sparkles}
        title="Evolution Lab"
        subtitle="Self-rewriting, meta-evolution, self-healing debugger, and evolutionary solver"
        description="The Evolution Lab is where Titan improves itself. The Self-Rewriter analyzes its own code, proposes improvements, tests them in a sandbox, and auto-applies only if performance improves. The Meta-Evolution system evolves strategies across tasks. The Self-Healing Debugger learns from past bugs and can auto-fix new ones. The Evolutionary Solver uses genetic algorithms to find solutions."
        tips={[
          'Self-Rewriter only applies changes if tests pass and performance improves',
          'If a rewrite degrades performance, it auto-rolls back',
          'The debugger stores lessons from each bug — so the same mistake never happens twice',
          'From chat: titan chat "diagnose and propose improvements to the runner"',
        ]}
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {evoStats && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-accent-primary" />
              <h2 className="text-h3 text-text-primary">Meta-Evolution</h2>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-small text-text-secondary">Total Evolutions</span><span className="text-sm font-medium text-text-primary">{evoStats.totalEvolutions}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Applied</span><span className="text-sm font-medium text-success">{evoStats.appliedEvolutions}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Rolled Back</span><span className="text-sm font-medium text-error">{evoStats.rolledBackEvolutions}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">A/B Tests</span><span className="text-sm font-medium text-text-primary">{evoStats.totalABTests}</span></div>
            </div>
          </div>
        )}

        {rewriteStats && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="w-4 h-4 text-accent-secondary" />
              <h2 className="text-h3 text-text-primary">Self-Rewriter</h2>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-small text-text-secondary">Total Versions</span><span className="text-sm font-medium text-text-primary">{rewriteStats.totalVersions}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Current Version</span><span className="text-sm font-medium text-text-primary">{rewriteStats.currentVersion}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Performance</span><span className="text-sm font-medium text-success">{(rewriteStats.currentPerformance * 100).toFixed(0)}%</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Improvement Rate</span><span className="text-sm font-medium text-accent-primary">{(rewriteStats.improvementRate * 100).toFixed(0)}%</span></div>
            </div>
          </div>
        )}

        {debugStats && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-accent-tertiary" />
              <h2 className="text-h3 text-text-primary">Self-Healing Debugger</h2>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-small text-text-secondary">Total Lessons</span><span className="text-sm font-medium text-text-primary">{debugStats.totalLessons}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Total Attempts</span><span className="text-sm font-medium text-text-primary">{debugStats.totalAttempts}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Success Rate</span><span className="text-sm font-medium text-success">{debugStats.successRate}%</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
