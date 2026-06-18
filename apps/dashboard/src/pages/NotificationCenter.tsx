import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';

interface Notification { id: string; type: 'info' | 'warning' | 'error' | 'success'; title: string; body?: string; read: boolean; createdAt: string }

const ICON_MAP = { info: <Info className="w-4 h-4 text-blue-400" />, warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />, error: <AlertCircle className="w-4 h-4 text-red-400" />, success: <CheckCircle className="w-4 h-4 text-green-400" /> };

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetch(`${API_BASE}/user/notifications`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && (d as Record<string, unknown>).notifications) setNotifications((d as Record<string, unknown>).notifications as Notification[]); })
      .catch(() => {});
  }, []);

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = (id: string) => setNotifications(notifications.map((n) => n.id === id ? { ...n, read: true } : n));
  const markAllRead = () => setNotifications(notifications.map((n) => ({ ...n, read: true })));
  const remove = (id: string) => setNotifications(notifications.filter((n) => n.id !== id));

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="w-6 h-6 text-amber-500" /> Notifications {unreadCount > 0 && <span className="text-sm bg-red-600 px-2 py-0.5 rounded-full">{unreadCount}</span>}</h1>
        <div className="flex gap-2">
          <button onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700">{filter === 'all' ? 'Unread Only' : 'Show All'}</button>
          {unreadCount > 0 && <button onClick={markAllRead} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 flex items-center gap-1"><Check className="w-3 h-3" /> Mark All Read</button>}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-12 border border-zinc-800 text-center text-zinc-500"><Bell className="w-12 h-12 mx-auto mb-4 opacity-20" /><p>No notifications</p></div>
      ) : (
        <div className="space-y-2">{filtered.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border ${n.read ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-zinc-900 border-zinc-700'}`}>
            <div className="mt-0.5">{ICON_MAP[n.type]}</div>
            <div className="flex-1">
              <div className="font-medium text-sm">{n.title}</div>
              {n.body && <p className="text-xs text-zinc-400 mt-1">{n.body}</p>}
              <p className="text-xs text-zinc-600 mt-1">{n.createdAt}</p>
            </div>
            <div className="flex gap-1">
              {!n.read && <button onClick={() => markRead(n.id)} className="p-1 hover:bg-zinc-700 rounded"><Check className="w-3 h-3" /></button>}
              <button onClick={() => remove(n.id)} className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
