import { useState, useEffect, useCallback } from 'react';
import { Brain, TrendingUp, ThumbsUp, ThumbsDown, Lightbulb, BarChart3, Loader2, MessageSquare, GraduationCap } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface LearningStats {
  totalFeedback: number;
  positiveRate: number;
  negativeRate: number;
  totalInsights: number;
  totalPatterns: number;
  promptCategories: number;
  topComplaints: string[];
  topPraises: string[];
}

interface Insight {
  type: string;
  description: string;
  confidence: number;
  evidence: number;
  recommendation: string;
}

interface Pattern {
  strategy: string;
  taskType: string;
  successRate: number;
  avgDuration: number;
  avgTokens: number;
  sampleSize: number;
}

interface Suggestion {
  category: string;
  bestVariant: string;
  successRate: number;
  uses: number;
}

export default function Learning() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, insightsRes, patternsRes, suggestionsRes] = await Promise.all([
        api.get<LearningStats>('/learning/v2/stats'),
        api.get<{ insights: Insight[]; total: number }>('/learning/v2/insights'),
        api.get<{ patterns: Pattern[]; total: number }>('/learning/v2/patterns'),
        api.get<{ suggestions: Suggestion[]; total: number }>('/learning/v2/suggestions'),
      ]);
      setStats(statsRes);
      setInsights(insightsRes.insights);
      setPatterns(patternsRes.patterns);
      setSuggestions(suggestionsRes.suggestions);
    } catch {
      toast.error('Failed to load learning data');
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
        pageKey="learning"
        icon={GraduationCap}
        title="Learning System"
        subtitle="Agent insights, feedback analysis, and strategy optimization"
        description="The Learning System tracks how Titan improves over time. It analyzes user feedback (thumbs up/down), identifies patterns in what works and what doesn\'t, and optimizes strategies. The system uses A/B testing to compare different approaches and keeps the winners. Use this page to view learning stats, feedback trends, and strategy performance."
        tips={[
          'Feedback from chat (thumbs up/down) feeds directly into learning',
          'A/B tests compare different strategies — winners are automatically promoted',
          'From chat: titan chat "show me my learning insights"',
        ]}
      />

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="w-4 h-4 text-success" />
              <span className="text-small text-text-secondary">Positive Rate</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{(stats.positiveRate * 100).toFixed(0)}%</p>
            <p className="text-caption text-text-muted mt-1">{stats.totalFeedback} total feedback</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-accent-primary" />
              <span className="text-small text-text-secondary">Insights</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.totalInsights}</p>
            <p className="text-caption text-text-muted mt-1">learned patterns</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-accent-secondary" />
              <span className="text-small text-text-secondary">Strategies</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.totalPatterns}</p>
            <p className="text-caption text-text-muted mt-1">tuned strategies</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-accent-tertiary" />
              <span className="text-small text-text-secondary">Prompt Variants</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.promptCategories}</p>
            <p className="text-caption text-text-muted mt-1">optimized categories</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Insights */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-accent-primary" />
              Insights
            </h2>
          </div>
          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Brain className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No insights yet — agent needs more runs to learn</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {insights.map((insight, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge bg-accent-primary/10 text-accent-primary text-caption">{insight.type}</span>
                    <span className="text-caption text-text-muted">{(insight.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                  <p className="text-sm text-text-primary">{insight.description}</p>
                  <p className="text-caption text-text-secondary mt-1">→ {insight.recommendation}</p>
                  <p className="text-caption text-text-muted mt-0.5">{insight.evidence} samples</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Strategy Performance */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-secondary" />
              Strategy Performance
            </h2>
          </div>
          {patterns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No strategy data yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {patterns.map((p, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">{p.strategy}</span>
                    <span className="text-caption text-text-muted">{p.taskType}</span>
                  </div>
                  <div className="flex items-center gap-4 text-caption text-text-secondary">
                    <span>Success: <span className="text-success font-medium">{(p.successRate * 100).toFixed(0)}%</span></span>
                    <span>Avg: {(p.avgDuration / 1000).toFixed(1)}s</span>
                    <span>Tokens: {p.avgTokens.toFixed(0)}</span>
                    <span>{p.sampleSize} runs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top complaints & praises */}
      {stats && (stats.topComplaints.length > 0 || stats.topPraises.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="text-h3 text-text-primary flex items-center gap-2 mb-3">
              <ThumbsDown className="w-4 h-4 text-error" />
              Top Complaints
            </h2>
            <div className="flex flex-wrap gap-2">
              {stats.topComplaints.length > 0 ? stats.topComplaints.map((c, i) => (
                <span key={i} className="badge bg-error/10 text-error">{c}</span>
              )) : <p className="text-small text-text-muted">No complaints yet</p>}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="text-h3 text-text-primary flex items-center gap-2 mb-3">
              <ThumbsUp className="w-4 h-4 text-success" />
              Top Praises
            </h2>
            <div className="flex flex-wrap gap-2">
              {stats.topPraises.length > 0 ? stats.topPraises.map((p, i) => (
                <span key={i} className="badge bg-success/10 text-success">{p}</span>
              )) : <p className="text-small text-text-muted">No praises yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* Prompt optimization suggestions */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-h3 text-text-primary flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent-tertiary" />
            Prompt Optimization
          </h2>
        </div>
        {suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-8 h-8 text-text-muted mb-2" />
            <p className="text-small text-text-secondary">No prompt optimization data yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{s.category}</p>
                  <p className="text-caption text-text-muted">Best variant: {s.bestVariant}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-success font-medium">{s.successRate}% success</p>
                  <p className="text-caption text-text-muted">{s.uses} uses</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
