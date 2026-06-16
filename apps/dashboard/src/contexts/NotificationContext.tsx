import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'agent';
  read: boolean;
  timestamp: Date;
  link?: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider');
  return ctx;
}

const WS_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_WS_URL ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const raw = localStorage.getItem('titan_notifications');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<Omit<Notification, 'timestamp'> & { timestamp: string }>;
      return parsed.map((n) => ({ ...n, timestamp: new Date(n.timestamp) })).slice(0, 50);
    } catch { return []; }
  });

  useEffect(() => {
    const toSave = notifications.map((n) => ({ ...n, timestamp: n.timestamp.toISOString() }));
    localStorage.setItem('titan_notifications', JSON.stringify(toSave));
  }, [notifications]);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications((prev) => {
      const next = [
        {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...n,
          read: false,
          timestamp: new Date(),
        },
        ...prev,
      ];
      if (next.length > 100) next.pop();
      return next;
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // WebSocket listener for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('titan_access_token') ?? '';
    const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.method === 'agent.run.updated') {
          const { runId, agentId, status, currentStep } = msg.params ?? {};
          const isDone = status === 'completed' || status === 'failed';
          addNotification({
            title: isDone ? 'Agent run finished' : 'Agent run updated',
            message: `Run ${runId?.slice(0, 8) ?? '—'} for agent ${agentId?.slice(0, 12) ?? '—'} → ${status}${currentStep !== undefined ? ` (step ${currentStep})` : ''}`,
            type: status === 'failed' ? 'error' : isDone ? 'success' : 'agent',
            link: `/runs`,
          });
        } else if (msg.method === 'agent.step') {
          const { runId, step } = msg.params ?? {};
          if (step?.actionName) {
            addNotification({
              title: 'Agent tool call',
              message: `Run ${runId?.slice(0, 8) ?? '—'} used tool: ${step.actionName}`,
              type: 'info',
              link: `/runs`,
            });
          }
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, [addNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        removeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
