import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { getToken } from '../api/client';
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  Trash2,
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import 'xterm/css/xterm.css';

const WS_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_WS_URL ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [currentDir, setCurrentDir] = useState('/');
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const historyIndexRef = useRef(-1);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_BASE_DELAY = 1000;

  const initTerminal = () => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
      theme: {
        background: '#0f172a',
        foreground: '#94a3b8',
        cursor: '#818cf8',
        black: '#1e293b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e2e8f0',
        brightBlack: '#334155',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#f8fafc',
      },
      scrollback: 5000,
      convertEol: true,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);

    term.open(terminalRef.current);
    requestAnimationFrame(() => {
      try { fit.fit(); } catch { /* terminal not ready yet */ }
    });

    xtermRef.current = term;
    fitAddonRef.current = fit;

    const resizeObs = new ResizeObserver(() => {
      try { fit.fit(); } catch { /* ignore resize during teardown */ }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });
    if (terminalRef.current) resizeObs.observe(terminalRef.current);

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    return () => resizeObs.disconnect();
  };

  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      xtermRef.current?.writeln('\r\n\x1b[31mMax reconnect attempts reached. Click Connect to retry.\x1b[0m');
      setConnectionState('disconnected');
      return;
    }

    const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;
    setConnectionState('reconnecting');
    xtermRef.current?.writeln(`\r\n\x1b[33mReconnecting in ${delay / 1000}s... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})\x1b[0m`);

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    intentionalCloseRef.current = false;
    setConnectionState('connecting');

    const token = getToken();
    if (!token) {
      xtermRef.current?.writeln('\r\n\x1b[31mNo auth token — please log in first\x1b[0m');
      setConnectionState('disconnected');
      return;
    }

    const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnectionState('connected');
      xtermRef.current?.writeln('\r\n\x1b[32mConnected to Titan Terminal\x1b[0m\r\n');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'output') {
          xtermRef.current?.write(msg.data);
        } else if (msg.type === 'error') {
          xtermRef.current?.write(`\r\n\x1b[31m${msg.data}\x1b[0m\r\n`);
        } else if (msg.type === 'cwd') {
          setCurrentDir(msg.data);
        } else if (msg.type === 'exit') {
          xtermRef.current?.write(`\r\n\x1b[33m[Process exited with code ${msg.code ?? 0}]\x1b[0m\r\n`);
        }
      } catch {
        xtermRef.current?.write(event.data as string);
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      if (!intentionalCloseRef.current) {
        scheduleReconnect();
      } else {
        xtermRef.current?.writeln('\r\n\x1b[31mDisconnected\x1b[0m');
      }
    };

    ws.onerror = () => {
      xtermRef.current?.writeln('\r\n\x1b[31mConnection error\x1b[0m');
    };
  }, [scheduleReconnect]);

  const disconnect = () => {
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionState('disconnected');
  };

  const clear = () => {
    xtermRef.current?.clear();
  };

  const runCommand = () => {
    if (!command.trim() || connectionState !== 'connected') return;
    wsRef.current?.send(JSON.stringify({ type: 'command', command: command.trim() }));
    setHistory((prev) => [...prev, command.trim()]);
    historyIndexRef.current = -1;
    setCommand('');
  };

  useEffect(() => {
    const cleanup = initTerminal();
    connect();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && document.activeElement === document.querySelector('input')) {
        e.preventDefault();
        const idx = history.length - 1;
        if (idx >= 0) {
          setCommand(history[idx]);
        }
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      disconnect();
      xtermRef.current?.dispose();
      xtermRef.current = null;
      window.removeEventListener('keydown', handleKey);
      if (cleanup) cleanup();
    };
  }, []);

  const statusConfig = {
    connected: { icon: <Wifi className="h-3.5 w-3.5" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Connected' },
    connecting: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Connecting...' },
    reconnecting: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Reconnecting...' },
    disconnected: { icon: <WifiOff className="h-3.5 w-3.5" />, color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Disconnected' },
  };

  const status = statusConfig[connectionState];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${status.color}`}>
            {status.icon}
            {status.label}
          </div>
          <span className="text-xs text-slate-500 font-mono">{currentDir}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={clear} className="btn-secondary" aria-label="Clear terminal">
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
          {connectionState === 'connected' ? (
            <button onClick={disconnect} className="btn-danger">
              <Square className="h-4 w-4" />
              Disconnect
            </button>
          ) : (
            <button onClick={() => { reconnectAttemptsRef.current = 0; connect(); }} className="btn-primary" disabled={connectionState === 'connecting'}>
              <Play className="h-4 w-4" />
              Connect
            </button>
          )}
          <button onClick={() => { reconnectAttemptsRef.current = 0; disconnect(); setTimeout(connect, 100); }} className="btn-secondary" aria-label="Reconnect terminal">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div className="card p-0 flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-3 right-3 z-10">
          <TerminalIcon className="h-4 w-4 text-slate-600" />
        </div>
        <div ref={terminalRef} className="flex-1 p-2" />
      </div>

      {/* Command Input */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-emerald-400 font-mono">❯</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runCommand();
          }}
          placeholder={connectionState === 'connected' ? 'Type command...' : 'Connect first...'}
          disabled={connectionState !== 'connected'}
          className="input flex-1 font-mono"
          aria-label="Terminal command input"
        />
        <button onClick={runCommand} disabled={connectionState !== 'connected' || !command.trim()} className="btn-primary">
          <Send className="h-4 w-4" />
          Run
        </button>
      </div>
    </div>
  );
}
