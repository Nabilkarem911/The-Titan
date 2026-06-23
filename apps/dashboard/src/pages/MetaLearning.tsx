import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Loader2, RefreshCw, TrendingUp, Brain, Zap } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface MetaLearningStats {
  totalEvolutions: number;
  appliedEvolutions: number;
  totalABTests: number;
  appliedTransfers: number;
}

interface CrossUserInsight {
  category: string;
  pattern: string;
  frequency: number;
  confidence: number;
}

interface PromptOptStats {
  categories: number;
  totalVariants: number;
  topVariants: Array<{ category: string; variant: string; successRate: number; uses: number }>;
}

export default function MetaLearning() {
  const [metaStats, setMetaStats] = useState<MetaLearningStats | null>(null);
  const [insights, setInsights] = useState<CrossUserInsight[]>([]);
  const [promptStats, setPromptStats] = useState<PromptOptStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meta, crossUser, prompt] = await Promise.all([
        api.get<MetaLearningStats>('/evolution/stats').catch(() => null),
        api.get<{ insights: CrossUserInsight[] }>('/cross-user/insights').catch(() => ({ insights: [] })),
        api.get<PromptOptStats>('/learning/v2/suggestions').catch(() => null),
      ]);
      setMetaStats(meta);
      setInsights(crossUser.insights ?? []);
      setPromptStats(prompt);
    } catch {
      toast.error('Failed to load meta-learning data');
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
        pageKey="metaLearning"
        icon={GraduationCap}
        title="Meta-Learning"
        subtitle="Meta-learning optimization, strategy tuning, prompt optimization, and cross-user learning"
        description="Meta-Learning is Titan's ability to learn how to learn. It tracks which strategies work best for different task types, optimizes prompts across categories, and shares insights across users (anonymously). The system evolves its own learning parameters over time — getting better at learning, not just at doing. Use this page to view optimization stats, cross-user insights, and prompt variants."
        tips={[
          'Cross-user insights show patterns learned from all users (anonymized)',
          'Prompt variants are different phrasings Titan tried — the best ones are kept',
          'From chat: titan chat "optimize my learning parameters"',
        ]}
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {metaStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-accent-primary" /><span className="text-small text-text-secondary">Evolutions</span></div>
            <p className="text-h2 font-bold text-text-primary">{metaStats.totalEvolutions}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-success" /><span className="text-small text-text-secondary">Applied</span></div>
            <p className="text-h2 font-bold text-text-primary">{metaStats.appliedEvolutions}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Brain className="w-4 h-4 text-accent-secondary" /><span className="text-small text-text-secondary">A/B Tests</span></div>
            <p className="text-h2 font-bold text-text-primary">{metaStats.totalABTests}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><GraduationCap className="w-4 h-4 text-accent-tertiary" /><span className="text-small text-text-secondary">Transfers</span></div>
            <p className="text-h2 font-bold text-text-primary">{metaStats.appliedTransfers}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary">Cross-User Insights ({insights.length})</h2>
          </div>
          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Brain className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No cross-user patterns yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle max-h-80 overflow-y-auto">
              {insights.map((ins, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge bg-accent-primary/10 text-accent-primary text-caption">{ins.category}</span>
                    <span className="text-caption text-text-muted">{ins.frequency} occurrences</span>
                  </div>
                  <p className="text-sm text-text-primary">{ins.pattern}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary">Prompt Optimization</h2>
          </div>
          {promptStats?.topVariants && promptStats.topVariants.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {promptStats.topVariants.slice(0, 10).map((v, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">{v.category}</span>
                    <span className="text-sm text-success">{v.successRate}%</span>
                  </div>
                  <p className="text-caption text-text-secondary mt-0.5">{v.variant}</p>
                  <p className="text-caption text-text-muted">{v.uses} uses</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No prompt optimization data yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
