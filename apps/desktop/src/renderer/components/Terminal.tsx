import { useState, useRef, useEffect } from 'react';
import { TerminalSquare, X, Plus } from 'lucide-react';

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  content: string;
}

export function Terminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'output', content: 'Titan Desktop Terminal — type commands and press Enter' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.scrollTo(0, containerRef.current.scrollHeight);
  }, [lines]);

  const execute = async () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    setHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);
    setLines((prev) => [...prev, { type: 'input', content: cmd }]);
    setInput('');

    try {
      const res = await (window as any).titan.executeCommand(cmd);
      if (res?.stdout) setLines((prev) => [...prev, { type: 'output', content: res.stdout }]);
      if (res?.stderr) setLines((prev) => [...prev, { type: 'error', content: res.stderr }]);
      if (!res?.stdout && !res?.stderr && res?.error) {
        setLines((prev) => [...prev, { type: 'error', content: res.error }]);
      }
    } catch (err) {
      setLines((prev) => [...prev, { type: 'error', content: String(err) }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      execute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx !== -1) {
        const newIdx = historyIdx + 1;
        if (newIdx >= history.length) {
          setHistoryIdx(-1);
          setInput('');
        } else {
          setHistoryIdx(newIdx);
          setInput(history[newIdx]);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center px-4 gap-2 glass">
        <TerminalSquare size={16} className="text-accent" />
        <span className="font-semibold text-sm">Terminal</span>
        <div className="flex-1" />
        <button className="p-1 rounded hover:bg-bg-tertiary transition-colors">
          <Plus size={14} className="text-text-muted" />
        </button>
      </div>

      {/* Terminal output */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 mono text-sm bg-bg-secondary"
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-all ${
              line.type === 'input'
                ? 'text-accent'
                : line.type === 'error'
                ? 'text-danger'
                : 'text-text-secondary'
            }`}
          >
            {line.type === 'input' ? `$ ${line.content}` : line.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-accent mono text-sm">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none mono text-sm text-text-primary"
            placeholder="Enter command..."
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
