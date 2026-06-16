import { useState, useEffect } from 'react';
import { RefreshCw, Loader2, List, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { QUEUE_NAMES } from '../api/constants';

interface QueueInfo {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export default function Queue() {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const getToken = () => localStorage.getItem('titan_access_token') ?? '';

  const fetchStats = async () => {
    setLoading(true);
    try {
      const results: QueueInfo[] = [];
      for (const name of QUEUE_NAMES) {
        try {
          const res = await fetch(`/api/v1/admin/queues/${name}/stats`, {
            headers: { 'Authorization': `Bearer ${getToken()}` },
          });
          if (res.ok) {
            const data = await res.json();
            results.push({ name, ...data });
          } else {
            results.push({ name, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });
          }
        } catch {
          results.push({ name, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });
        }
      }
      setQueues(results);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Queue Monitor</h1>
          <p className="text-slate-400 mt-1">
            Real-time BullMQ queue statistics.
            {lastUpdated && ` Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={fetchStats} className="btn-secondary" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Waiting', value: queues.reduce((s, q) => s + q.waiting, 0), icon: Clock, color: 'text-amber-400' },
          { label: 'Active', value: queues.reduce((s, q) => s + q.active, 0), icon: Activity, color: 'text-indigo-400' },
          { label: 'Completed', value: queues.reduce((s, q) => s + q.completed, 0), icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Failed', value: queues.reduce((s, q) => s + q.failed, 0), icon: XCircle, color: 'text-red-400' },
          { label: 'Delayed', value: queues.reduce((s, q) => s + q.delayed, 0), icon: List, color: 'text-slate-400' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <stat.icon className={`h-5 w-5 mx-auto mb-2 ${stat.color}`} />
            <div className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Queue table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3 font-medium">Queue</th>
              <th className="px-6 py-3 font-medium text-right">Waiting</th>
              <th className="px-6 py-3 font-medium text-right">Active</th>
              <th className="px-6 py-3 font-medium text-right">Completed</th>
              <th className="px-6 py-3 font-medium text-right">Failed</th>
              <th className="px-6 py-3 font-medium text-right">Delayed</th>
              <th className="px-6 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {queues.map((q) => {
              const total = q.waiting + q.active + q.completed + q.failed + q.delayed;
              return (
                <tr key={q.name} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-3 font-mono text-indigo-400">{q.name}</td>
                  <td className="px-6 py-3 text-right text-amber-400">{q.waiting}</td>
                  <td className="px-6 py-3 text-right text-indigo-400">{q.active}</td>
                  <td className="px-6 py-3 text-right text-emerald-400">{q.completed}</td>
                  <td className="px-6 py-3 text-right text-red-400">{q.failed}</td>
                  <td className="px-6 py-3 text-right text-slate-400">{q.delayed}</td>
                  <td className="px-6 py-3 text-right font-medium text-white">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {queues.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading queue stats...
          </div>
        )}
      </div>
    </div>
  );
}
