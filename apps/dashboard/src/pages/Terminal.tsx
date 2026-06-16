import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  Trash2,
  RefreshCw,
  Send,
} from 'lucide-react';
import 'xterm/css/xterm.css';

const WS_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_WS_URL ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/terminal`;

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [currentDir, setCurrentDir] = useState('/');
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const historyIndexRef = useRef(-1);

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
    fit.fit();

    xtermRef.current = term;
    fitAddonRef.current = fit;

    // Handle resize
    const resizeObs = new ResizeObserver(() => {
      fit.fit();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });
    if (terminalRef.current) resizeObs.observe(terminalRef.current);

    // Handle keyboard input for interactive mode
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    return () => resizeObs.disconnect();
  };

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setConnecting(true);

    const token = localStorage.getItem('titan_access_token') ?? '';
    const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
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
      setConnected(false);
      setConnecting(false);
      xtermRef.current?.writeln('\r\n\x1b[31mConnection closed\x1b[0m');
    };

    ws.onerror = () => {
      setConnecting(false);
      xtermRef.current?.writeln('\r\n\x1b[31mConnection error\x1b[0m');
    };
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  };

  const clear = () => {
    xtermRef.current?.clear();
  };

  const runCommand = () => {
    if (!command.trim() || !connected) return;
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

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
            <span className="text-sm font-medium text-slate-200">
              {connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono">{currentDir}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={clear} className="btn-secondary">
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
          {connected ? (
            <button onClick={disconnect} className="btn-danger">
              <Square className="h-4 w-4" />
              Disconnect
            </button>
          ) : (
            <button onClick={connect} className="btn-primary">
              <Play className="h-4 w-4" />
              Connect
            </button>
          )}
          <button onClick={connect} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div className="card p-0 flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
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
          placeholder={connected ? 'Type command...' : 'Connect first...'}
          disabled={!connected}
          className="input flex-1 font-mono"
        />
        <button onClick={runCommand} disabled={!connected || !command.trim()} className="btn-primary">
          <Send className="h-4 w-4" />
          Run
        </button>
      </div>
    </div>
  );
}
