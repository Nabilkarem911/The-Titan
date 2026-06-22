import { useState, useRef, useEffect } from 'react';
import { Send, Camera, Cpu, FolderOpen, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../stores/app-store.js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: string[];
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const serverUrl = useAppStore((s) => s.serverUrl);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const prompt = input.trim();
    setInput('');
    setLoading(true);

    try {
      const settings = await (window as any).titan?.getSettings();
      const token = settings?.token;
      if (!token) {
        throw new Error('Not authenticated — please log in again');
      }

      const res = await fetch(`${serverUrl}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt,
          sessionId: sessionIdRef.current,
          stream: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || err.message || `Server error (${res.status})`);
      }

      const data = await res.json() as { answer?: string; sessionId?: string };
      if (data.sessionId) sessionIdRef.current = data.sessionId;

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer || 'No response received',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  const quickAction = (action: string) => {
    setInput(action);
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center px-4 gap-2 glass">
        <Sparkles size={16} className="text-accent" />
        <span className="font-semibold text-sm">Titan Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
              <Sparkles size={28} className="text-white" />
            </div>
            <p className="text-sm">Start a conversation with Titan</p>
            <div className="flex gap-2">
              <button
                onClick={() => quickAction('Take a screenshot of my screen')}
                className="px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-border text-xs flex items-center gap-1.5 transition-colors"
              >
                <Camera size={14} /> Screenshot
              </button>
              <button
                onClick={() => quickAction('Show me my system info')}
                className="px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-border text-xs flex items-center gap-1.5 transition-colors"
              >
                <Cpu size={14} /> System Info
              </button>
              <button
                onClick={() => quickAction('List files in my Desktop')}
                className="px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-border text-xs flex items-center gap-1.5 transition-colors"
              >
                <FolderOpen size={14} /> List Files
              </button>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-primary'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <span className={`text-[10px] mt-1 block ${msg.role === 'user' ? 'text-white/60' : 'text-text-muted'}`}>
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-tertiary rounded-xl px-4 py-3 flex gap-1">
              <div className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 glass">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Message Titan..."
            rows={1}
            className="flex-1 bg-bg-tertiary border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent transition-colors"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
