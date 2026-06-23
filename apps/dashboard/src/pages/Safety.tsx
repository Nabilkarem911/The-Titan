import { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, CheckCircle, Loader2, Brain } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface SafetyStats {
  totalCells: number;
  totalChecks: number;
  blocked: number;
  allowed: number;
  blockRate: number;
  topStrategies: Array<{ strategy: string; count: number }>;
}

interface GuardrailResult {
  allowed: boolean;
  reason: string;
  severity?: string;
}

export default function Safety() {
  const [stats, setStats] = useState<SafetyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [context, setContext] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<GuardrailResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<SafetyStats>('/safety/stats');
      setStats(res);
    } catch {
      toast.error('Failed to load safety data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCheck = async () => {
    if (!action.trim()) return;
    setChecking(true);
    try {
      const res = await api.post<GuardrailResult>('/safety/check', { action, context });
      setResult(res);
    } catch {
      toast.error('Failed to check action');
    } finally {
      setChecking(false);
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
        pageKey="safety"
        icon={Shield}
        title="Safety & Guardrails"
        subtitle="Safety memory, guardrail checks, and anti-sycophancy"
        description="Titan's Safety system prevents harmful actions through multi-layer guardrails. The Safety Memory learns from past mistakes using contrastive cells — each cell stores a dangerous action and its safe alternative. Every action Titan takes is checked against these guardrails before execution. Use this page to view safety stats, run manual safety checks, and monitor blocked actions."
        tips={[
          'Type any action in the check box below to see if Titan would allow or block it',
          'The block rate shows how cautious Titan is — a healthy rate is 5-15%',
          'From chat: titan chat "check safety of: rm -rf /tmp"',
        ]}
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-accent-primary" />
              <span className="text-small text-text-secondary">Total Cells</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.totalCells}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-small text-text-secondary">Allowed</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.allowed}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-error" />
              <span className="text-small text-text-secondary">Blocked</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{stats.blocked}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-accent-tertiary" />
              <span className="text-small text-text-secondary">Block Rate</span>
            </div>
            <p className="text-h2 font-bold text-text-primary tabular-nums">{(stats.blockRate * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-4">Check Action Safety</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Action to check (e.g. 'delete all files')"
            className="input w-full"
          />
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Additional context (optional)"
            className="input w-full"
          />
          <button onClick={handleCheck} disabled={checking || !action.trim()} className="btn-primary flex items-center gap-2">
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Check Safety
          </button>
        </div>
        {result && (
          <div className={`mt-4 p-4 rounded-btn border ${result.allowed ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'}`}>
            <div className="flex items-center gap-2 mb-1">
              {result.allowed ? <CheckCircle className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-error" />}
              <span className="text-sm font-medium text-text-primary">{result.allowed ? 'Allowed' : 'Blocked'}</span>
            </div>
            <p className="text-small text-text-secondary">{result.reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
