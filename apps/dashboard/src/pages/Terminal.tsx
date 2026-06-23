import { useEffect, useRef, useState } from 'react';
import { TerminalSquare } from 'lucide-react';
import { TOKEN_KEY } from '../utils/constants';
import { PageHeader } from '../components/PageHeader';

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setTerm] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const { Terminal: XTerm } = await import('xterm');
        const { FitAddon } = await import('@xterm/addon-fit');
        if (disposed || !containerRef.current) return;

        const term = new XTerm({
          theme: {
            background: '#0A0E1A',
            foreground: '#F1F5F9',
            cursor: '#06B6D4',
          },
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 14,
          cursorBlink: true,
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();
        setTerm(term);

        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
          setError('Not authenticated');
          return;
        }

        const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/terminal?token=${token}`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'output') term.write(msg.data);
            if (msg.type === 'exit') term.write(`\r\n[Process exited with code ${msg.code}]\r\n`);
          } catch { /* ignore */ }
        };

        ws.onopen = () => {
          term.write('Connecting to Titan Terminal...\r\n');
        };

        ws.onerror = () => setError('WebSocket connection failed');

        term.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });

        const onResize = () => fitAddon.fit();
        window.addEventListener('resize', onResize);

        return () => {
          window.removeEventListener('resize', onResize);
          ws.close();
          term.dispose();
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize terminal');
      }
    })();
    return () => { disposed = true; };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border-subtle">
        <PageHeader
          pageKey="terminal"
          icon={TerminalSquare}
          title="Terminal"
          subtitle="Interactive shell in your workspace"
          description="The Terminal gives you a live shell inside the Titan server environment. Run commands, inspect files, manage processes — just like a real terminal. The connection is secured with your auth token and runs over WebSocket for real-time input/output."
          tips={[
            'The terminal runs in the Titan server environment, not your local machine',
            'Use it to inspect files, run scripts, or debug issues',
            'The connection is authenticated via your login token',
          ]}
        />
      </div>
      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-error">{error}</p>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 bg-void p-2 overflow-hidden" />
      )}
    </div>
  );
}
