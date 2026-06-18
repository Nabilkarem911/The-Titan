import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { getToken } from '../api/client';
import { ErrorState } from '../components/PageState';

export default function TerminalPage() {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/terminal?token=${encodeURIComponent(getToken())}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        setOutput((prev) => [...prev.slice(-500), String(event.data)]);
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        setConnected(false);
      };

      return () => ws.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, []);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [output]);

  const handleSend = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'input', data: input }));
    setOutput((prev) => [...prev, `$ ${input}`]);
    setInput('');
  };

  const handleRetry = () => {
    setError(null);
    setOutput([]);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10">
            <TerminalIcon className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Terminal</h2>
            <p className="text-sm text-slate-400">Remote terminal access</p>
          </div>
        </div>
        <span className={`badge ${connected ? 'badge-success' : 'badge-error'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={handleRetry} />
      ) : (
        <div className="card overflow-hidden">
          <div
            ref={termRef}
            className="bg-slate-950 p-4 font-mono text-sm text-emerald-400 h-[400px] overflow-y-auto"
          >
            {output.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap">{line}</div>
            ))}
          </div>
          <div className="border-t border-slate-800 p-2 flex gap-2">
            <span className="text-emerald-400 font-mono text-sm self-center px-2">$</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="input flex-1 font-mono"
              placeholder="Type a command..."
            />
            <button onClick={handleSend} className="btn-primary text-sm">Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
