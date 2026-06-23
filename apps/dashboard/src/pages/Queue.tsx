import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { api } from '../api/client';
import { Skeleton } from '../components/LoadingSkeleton';
import { PageHeader } from '../components/PageHeader';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

const QUEUE_NAMES = ['agent-execute', 'swarm-execute', 'tool-execute', 'memory-index', 'memory-retrieve', 'sandbox-exec', 'monitoring-check', 'audit-write', 'webhook-deliver'];

export default function Queue() {
  const [stats, setStats] = useState<Record<string, QueueStats | { error: string }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      const results: Record<string, QueueStats | { error: string }> = {};
      for (const name of QUEUE_NAMES) {
        try {
          results[name] = await api.get<QueueStats>(`/admin/queues/${name}/stats`);
        } catch {
          results[name] = { error: 'unavailable' };
        }
      }
      setStats(results);
      setIsLoading(false);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="queue"
        icon={Layers}
        title="Queue"
        subtitle="Live queue statistics (auto-refresh 5s)"
        description="The Queue page shows live statistics for all BullMQ job queues — pending, active, completed, failed, and delayed jobs. Queues power background tasks like agent runs, cron jobs, and webhooks. Use this page to monitor queue health and detect stuck jobs."
        tips={[
          'Stats auto-refresh every 5 seconds',
          'High pending count means jobs are queueing up faster than they process',
          'High failed count means something is wrong — check the Runs page for errors',
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {QUEUE_NAMES.map((name) => {
          const stat = stats[name];
          return (
            <div key={name} className="card p-5">
              <h3 className="text-h3 text-text-primary mb-3 font-mono">{name}</h3>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5" />)}
                </div>
              ) : stat && 'error' in stat ? (
                <p className="text-small text-error">{stat.error}</p>
              ) : stat ? (
                <div className="grid grid-cols-2 gap-2">
                  <StatItem label="Waiting" value={stat.waiting} color="text-queued" />
                  <StatItem label="Active" value={stat.active} color="text-running" />
                  <StatItem label="Completed" value={stat.completed} color="text-success" />
                  <StatItem label="Failed" value={stat.failed} color="text-error" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className={`text-h2 font-bold ${color} tabular-nums`}>{value}</p>
      <p className="text-caption text-text-muted">{label}</p>
    </div>
  );
}
