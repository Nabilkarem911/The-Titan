import { useState, useEffect, useCallback } from 'react';
import { Network, Loader2, RefreshCw, Plus, Activity, Cpu } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface SwarmTask {
  id: string;
  description: string;
  status: string;
  createdAt: string;
  result?: unknown;
}

interface SwarmEvolutionStats {
  topologiesCreated: number;
  reconfigurations: number;
  memoryEntries: number;
  federationTasks: number;
  completedTasks: number;
}

export default function HiveMind() {
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [evoStats, setEvoStats] = useState<SwarmEvolutionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [launching, setLaunching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, evoRes] = await Promise.all([
        api.get<{ tasks: SwarmTask[] }>('/swarm/tasks').catch(() => ({ tasks: [] })),
        api.get<SwarmEvolutionStats>('/swarm-evolution/stats').catch(() => null),
      ]);
      setTasks(tasksRes.tasks ?? []);
      setEvoStats(evoRes);
    } catch {
      toast.error('Failed to load hive mind data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLaunch = async () => {
    if (!description.trim()) return;
    setLaunching(true);
    try {
      await api.post('/swarm/run', { description });
      toast.success('Swarm task launched');
      setDescription('');
      await load();
    } catch {
      toast.error('Failed to launch swarm task');
    } finally {
      setLaunching(false);
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
        pageKey="hiveMind"
        icon={Network}
        title="Hive Mind"
        subtitle="Swarm intelligence, collective evolution, topology management, and federation"
        description="The Hive Mind is Titan's collective intelligence system. Multiple Titan instances can form a swarm — sharing knowledge, dividing tasks, and making collective decisions. The Swarm Evolution system automatically decides how many agents to spawn and what topology to use. Federation allows separate Titan instances to trade skills and share learned patterns. Use this page to launch swarm tasks, view topology stats, and monitor collective memory."
        tips={[
          'Type a task description below and click Launch to start a swarm task',
          'Swarm Evolution auto-decides the optimal number of agents and their roles',
          'Collective Memory is shared across all agents in the swarm',
          'From chat: titan chat "show hive mind stats"',
        ]}
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {evoStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Network className="w-4 h-4 text-accent-primary" /><span className="text-small text-text-secondary">Topologies</span></div>
            <p className="text-h2 font-bold text-text-primary">{evoStats.topologiesCreated}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><RefreshCw className="w-4 h-4 text-accent-secondary" /><span className="text-small text-text-secondary">Reconfigurations</span></div>
            <p className="text-h2 font-bold text-text-primary">{evoStats.reconfigurations}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Cpu className="w-4 h-4 text-accent-tertiary" /><span className="text-small text-text-secondary">Memory Entries</span></div>
            <p className="text-h2 font-bold text-text-primary">{evoStats.memoryEntries}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-success" /><span className="text-small text-text-secondary">Federation Tasks</span></div>
            <p className="text-h2 font-bold text-text-primary">{evoStats.federationTasks}</p>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-4">Launch Swarm Task</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task for the swarm..."
            className="input flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleLaunch()}
          />
          <button onClick={handleLaunch} disabled={launching || !description.trim()} className="btn-primary flex items-center gap-2">
            {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Launch
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-h3 text-text-primary">Swarm Tasks ({tasks.length})</h2>
        </div>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Network className="w-8 h-8 text-text-muted mb-2" />
            <p className="text-small text-text-secondary">No swarm tasks yet — launch one above</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {tasks.map((task) => (
              <div key={task.id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary">{task.description}</span>
                  <span className={`badge text-caption ${task.status === 'completed' ? 'bg-success/10 text-success' : task.status === 'failed' ? 'bg-error/10 text-error' : 'bg-accent-primary/10 text-accent-primary'}`}>{task.status}</span>
                </div>
                <p className="text-caption text-text-muted">{task.id}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
