import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, AlertCircle, CheckCircle, Info, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';

interface ServerNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
}

const ICON_MAP = {
  info: <Info className="h-4 w-4 text-blue-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  error: <AlertCircle className="h-4 w-4 text-red-400" />,
  success: <CheckCircle className="h-4 w-4 text-emerald-400" />,
};

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/user/notifications`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { notifications?: ServerNotification[] };
      setNotifications(d.notifications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = (id: string) => setNotifications(notifications.map((n) => n.id === id ? { ...n, read: true } : n));
  const markAllRead = () => setNotifications(notifications.map((n) => ({ ...n, read: true })));
  const remove = (id: string) => setNotifications(notifications.filter((n) => n.id !== id));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20 text-amber-400">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Notifications
              {unreadCount > 0 && <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
            </h3>
            <p className="text-xs text-slate-500">Activity and system notifications</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')} className="btn-secondary text-xs">
            {filter === 'all' ? 'Unread Only' : 'Show All'}
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-xs">
              <Check className="h-3 w-3" /> Mark All Read
            </button>
          )}
          <button onClick={fetchNotifications} className="btn-secondary" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchNotifications} />
      ) : loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6 text-slate-400" />}
          title="No notifications"
          description={filter === 'unread' ? 'No unread notifications' : 'Notifications will appear here'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div key={n.id} className={`card p-4 flex items-start gap-3 ${n.read ? 'opacity-60' : ''}`}>
              <div className="mt-0.5">{ICON_MAP[n.type]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{n.title}</div>
                {n.body && <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-slate-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {!n.read && (
                  <button onClick={() => markRead(n.id)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-emerald-400" aria-label="Mark as read">
                    <Check className="h-3 w-3" />
                  </button>
                )}
                <button onClick={() => remove(n.id)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400" aria-label="Dismiss">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
