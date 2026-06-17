import { useState, useEffect, useRef } from 'react';
import {
  ScrollText,
  Trash2,
  AlertCircle,
  CheckCircle,
  Info,
  Terminal as TerminalIcon,
  Zap,
} from 'lucide-react';
import { getToken } from '../api/client';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'agent' | 'system';
  source: string;
  message: string;
  details?: Record<string, unknown>;
}

const WS_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_WS_URL ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'agent' | 'system' | 'error'>('all');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const addLog = (entry: LogEntry) => {
    setLogs((prev) => {
      const next = [...prev, entry];
      if (next.length > 500) next.shift();
      return next;
    });
  };

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    const token = getToken();
    const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      addLog({
        id: `sys-${Date.now()}`,
        timestamp: new Date(),
        level: 'system',
        source: 'websocket',
        message: 'Connected to log stream',
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.method === 'agent.run.updated') {
          const { runId, agentId, status, currentStep, tokensUsed } = msg.params ?? {};
          addLog({
            id: `run-${runId}-${Date.now()}`,
            timestamp: new Date(),
            level: 'agent',
            source: `agent:${agentId ?? 'unknown'}`,
            message: `Run ${runId?.slice(0, 8) ?? '—'} → ${status}${currentStep !== undefined ? ` (step ${currentStep})` : ''}`,
            details: { runId, agentId, status, currentStep, tokensUsed },
          });
        } else if (msg.method === 'agent.step') {
          const { runId, agentId, step } = msg.params ?? {};
          addLog({
            id: `step-${runId}-${Date.now()}`,
            timestamp: new Date(),
            level: 'agent',
            source: `agent:${agentId ?? 'unknown'}`,
            message: `Step ${step?.index ?? '—'}: ${step?.actionName ?? 'thinking'}`,
            details: { runId, step },
          });
        } else if (msg.jsonrpc === '2.0' && msg.id !== undefined) {
          // RPC response, ignore
        } else if (msg.jsonrpc === '2.0') {
          // Could be a notification
        }
      } catch {
        // Not JSON, ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
      addLog({
        id: `sys-${Date.now()}`,
        timestamp: new Date(),
        level: 'system',
        source: 'websocket',
        message: 'Disconnected from log stream',
      });
    };

    ws.onerror = () => {
      addLog({
        id: `sys-${Date.now()}`,
        timestamp: new Date(),
        level: 'error',
        source: 'websocket',
        message: 'WebSocket error',
      });
    };

    return () => ws.close();
  }, []);

  const clear = () => setLogs([]);

  const filtered = logs.filter((l) => {
    if (filter === 'all') return true;
    if (filter === 'error') return l.level === 'error';
    if (filter === 'agent') return l.level === 'agent';
    if (filter === 'system') return l.level === 'system' || l.level === 'info';
    return true;
  });

  const levelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
      case 'warn': return <AlertCircle className="h-3.5 w-3.5 text-amber-400" />;
      case 'agent': return <Zap className="h-3.5 w-3.5 text-indigo-400" />;
      case 'system': return <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />;
      default: return <Info className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const levelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400 border-red-500/20 bg-red-500/5';
      case 'warn': return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'agent': return 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5';
      case 'system': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      default: return 'text-slate-400 border-slate-700/30';
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-700/30 text-slate-400">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Live Logs</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {connected ? 'Connected' : 'Disconnected'}
              <span className="text-slate-600">|</span>
              {logs.length} entries
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/60 rounded-lg p-0.5 border border-slate-700/30">
            {(['all', 'agent', 'system', 'error'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  filter === f ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-slate-600"
            />
            Auto-scroll
          </label>
          <button onClick={clear} className="btn-secondary">
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Logs */}
      <div
        ref={containerRef}
        className="card p-0 flex-1 overflow-y-auto font-mono text-xs"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <TerminalIcon className="h-10 w-10 text-slate-700" />
            <p>Waiting for logs...</p>
            <p className="text-slate-600">Agent runs and system events will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/20">
            {filtered.map((log) => (
              <div key={log.id} className={`flex gap-3 px-4 py-2 ${levelColor(log.level)}`}>
                <div className="flex-shrink-0 mt-0.5">{levelIcon(log.level)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-0.5">
                    <span>{log.timestamp.toLocaleTimeString()}</span>
                    <span className="text-slate-600">{log.source}</span>
                  </div>
                  <div className="text-slate-200">{log.message}</div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre className="mt-1 text-[10px] text-slate-500 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2).slice(0, 200)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
