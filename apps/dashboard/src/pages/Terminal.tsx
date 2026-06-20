import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';
import { classNames } from '../utils/format';

export default function TerminalPage() {
  const termRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let disposed = false;
    async function init() {
      try {
        const { Terminal } = await import('xterm');
        const { FitAddon } = await import('@xterm/addon-fit');
        const { WebLinksAddon } = await import('@xterm/addon-web-links');

        if (disposed || !termRef.current) return;

        const term = new Terminal({
          cursorBlink: true,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          theme: {
            background: '#0A0F1D', foreground: '#F8FAFC', cursor: '#00F2FE',
            selectionBackground: 'rgba(0, 242, 254, 0.2)',
            black: '#0A0F1D', red: '#FF007A', green: '#10B981', yellow: '#F59E0B',
            blue: '#7000FF', magenta: '#A855F7', cyan: '#00F2FE', white: '#F8FAFC',
            brightBlack: '#64748B', brightRed: '#FF4D94', brightGreen: '#34D399',
            brightYellow: '#FBBF24', brightBlue: '#8B5CF6', brightMagenta: '#C084FC',
            brightCyan: '#67E8F9', brightWhite: '#FFFFFF',
          },
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.open(termRef.current);
        fitAddon.fit();

        const token = localStorage.getItem('titan_token');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws/terminal?token=${token}`);

        ws.onopen = () => { setIsConnected(true); term.writeln('\x1b[36mConnected to Titan terminal\x1b[0m\r\n'); };
        ws.onmessage = (e) => term.write(e.data);
        ws.onclose = () => { setIsConnected(false); term.writeln('\r\n\x1b[31mDisconnected\x1b[0m'); };
        ws.onerror = () => {
          setIsConnected(false);
          term.writeln('\x1b[33mTerminal connection unavailable. Local echo mode.\x1b[0m\r\n');
          let line = '';
          term.onData((data: string) => {
            if (data === '\r') { term.writeln(''); line = ''; term.write('\x1b[36m$ \x1b[0m'); }
            else if (data === '\x7f') { if (line.length) { line = line.slice(0, -1); term.write('\b \b'); } }
            else { line += data; term.write(data); }
          });
          term.write('\x1b[36m$ \x1b[0m');
        };

        term.onData((data: string) => { if (ws.readyState === WebSocket.OPEN) ws.send(data); });

        const ro = new ResizeObserver(() => fitAddon.fit());
        ro.observe(termRef.current);

        return () => { disposed = true; ro.disconnect(); ws.close(); term.dispose(); };
      } catch { /* xterm not available */ }
    }
    const cleanup = init();
    return () => { disposed = true; cleanup?.then((fn) => fn?.()); };
  }, []);

  return (
    <div className={classNames('flex flex-col', isFullscreen ? 'fixed inset-0 z-50 bg-deep p-4' : 'h-[calc(100vh-8rem)]')}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-5 h-5 text-cyan" />
          <span className="font-heading font-semibold text-text-primary">Terminal</span>
          <div className={classNames('w-2 h-2 rounded-full', isConnected ? 'bg-success' : 'bg-pink')} />
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="btn btn-ghost btn-sm">
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
      <div ref={termRef} className="flex-1 card overflow-hidden p-2" style={{ minHeight: '300px' }} />
    </div>
  );
}
