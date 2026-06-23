import { useState } from 'react';
import { Network, Plus, Users } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { toast } from 'sonner';
import type { ListResponse, SwarmTask } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { StatusBadge } from '../components/StatusBadge';
import { formatRelativeTime } from '../utils/format';
import { PageHeader } from '../components/PageHeader';

export default function Swarm() {
  const { data, isLoading, error, refetch } = useApi<ListResponse<SwarmTask>>('/swarm/tasks');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ description: '', prompt: '', agentCount: 2 });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const agents = Array.from({ length: form.agentCount }).map((_, i) => ({
        id: `agent-${i}`,
        role: i === 0 ? 'planner' as const : i === 1 ? 'executor' as const : 'reviewer' as const,
        name: `Agent ${i + 1}`,
        description: `Agent ${i + 1} for swarm task`,
        maxSteps: 10,
        priority: i,
      }));
      await api.post('/swarm/run', { description: form.description, prompt: form.prompt, agents });
      toast.success('Swarm task launched');
      setShowCreate(false);
      setForm({ description: '', prompt: '', agentCount: 2 });
      refetch();
    } catch (err) {
      toast.error('Failed to launch swarm', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="swarm"
        icon={Network}
        title="Swarm"
        subtitle="Multi-agent task orchestration"
        description="Swarm lets you launch multiple agents that work together on a task. Each agent has a role — planner, executor, or reviewer — and they coordinate to solve complex problems. The planner breaks down the task, executors work on sub-tasks in parallel, and the reviewer checks quality. Use this page to launch and monitor swarm tasks."
        tips={[
          'Click Launch Swarm to create a new multi-agent task',
          'Each swarm has a planner, executor(s), and a reviewer',
          'Sub-tasks run in parallel for faster completion',
          'From chat: titan chat "launch a swarm to research and summarize AI trends"',
        ]}
        accent="text-accent-secondary"
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Launch Swarm
          </button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data?.items.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.items.map((task) => (
            <div key={task.id} className="card-hover p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-btn bg-accent-secondary/10 flex items-center justify-center">
                  <Network className="w-5 h-5 text-accent-secondary" />
                </div>
                <StatusBadge status={task.status} pulse={task.status === 'running'} />
              </div>
              <h3 className="text-h3 text-text-primary mb-1">{task.description}</h3>
              <div className="flex items-center gap-4 text-caption text-text-muted">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {task.agentsCount} agents</span>
                <span>{task.completedSubTasks}/{task.subTasksCount} tasks</span>
                <span>{formatRelativeTime(task.createdAt)}</span>
              </div>
              {task.finalAnswer && (
                <p className="text-small text-text-secondary mt-3 line-clamp-2">{task.finalAnswer}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Network}
          title="No swarm tasks"
          description="Launch a multi-agent swarm to tackle complex tasks"
          action={{ label: 'Launch Swarm', onClick: () => setShowCreate(true) }}
        />
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreate(false)}>
          <div className="card p-6 max-w-lg w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 text-text-primary mb-4">Launch Swarm</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" required maxLength={500} />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Prompt</label>
                <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} className="input" rows={4} required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Agent Count (1-10)</label>
                <input type="number" value={form.agentCount} onChange={(e) => setForm({ ...form, agentCount: Math.min(10, Math.max(1, parseInt(e.target.value) || 2)) })} className="input" min={1} max={10} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Launch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
