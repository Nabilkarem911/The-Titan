import { useState, useEffect, useCallback } from 'react';
import { Coins, Loader2, RefreshCw, TrendingUp, Award } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface RLStats {
  totalEpisodes: number;
  avgReward: number;
  bestReward: number;
  qTableSize: number;
  converged: boolean;
}

export default function Economy() {
  const [rlStats, setRlStats] = useState<RLStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<RLStats>('/rl/stats').catch(() => null);
      setRlStats(res);
    } catch {
      toast.error('Failed to load economy data');
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
        icon={Coins}
        title="Economy & RL"
        subtitle="Reinforcement learning, autonomous trading, and agent economy"
        description="The Economy system uses Reinforcement Learning (Q-learning) to train agents through trial and error. Agents receive rewards for good actions and penalties for bad ones — gradually learning optimal strategies. The system tracks convergence (when learning stabilizes) and maintains a Q-table of state-action values. The Agent Economy also includes ComputeCredits — a marketplace where agents trade skills."
        tips={[
          'Episodes are training rounds — more episodes means more learning',
          'Convergence means the agent has found a stable optimal strategy',
          'The Q-Table stores the value of each action in each state',
          'From chat: titan chat "show economy stats"',
        ]}
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {rlStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-accent-primary" /><span className="text-small text-text-secondary">Total Episodes</span></div>
            <p className="text-h2 font-bold text-text-primary">{rlStats.totalEpisodes}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Award className="w-4 h-4 text-accent-secondary" /><span className="text-small text-text-secondary">Avg Reward</span></div>
            <p className="text-h2 font-bold text-text-primary">{rlStats.avgReward.toFixed(2)}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-success" /><span className="text-small text-text-secondary">Best Reward</span></div>
            <p className="text-h2 font-bold text-text-primary">{rlStats.bestReward.toFixed(2)}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Coins className="w-4 h-4 text-accent-tertiary" /><span className="text-small text-text-secondary">Q-Table Size</span></div>
            <p className="text-h2 font-bold text-text-primary">{rlStats.qTableSize}</p>
          </div>
        </div>
      )}

      {rlStats && (
        <div className="card p-5">
          <h2 className="text-h3 text-text-primary mb-3">Convergence Status</h2>
          <div className={`p-4 rounded-btn border ${rlStats.converged ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
            <p className="text-sm font-medium text-text-primary">
              {rlStats.converged ? '✓ Converged — RL policy is stable' : '⏳ Not yet converged — still learning'}
            </p>
          </div>
        </div>
      )}

      {!rlStats && (
        <div className="card p-5">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Coins className="w-8 h-8 text-text-muted mb-2" />
            <p className="text-small text-text-secondary">No RL data available — start training to see stats</p>
          </div>
        </div>
      )}
    </div>
  );
}
