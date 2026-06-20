import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      abortRef.current = new AbortController();
      for await (const chunk of api.stream('/chat', {
        prompt: userMsg.content,
        agentId: 'default-agent',
        stream: true,
      }, abortRef.current.signal)) {
        try {
          const parsed = JSON.parse(chunk);
          if (parsed.type === 'run.started') {
            // runId received, streaming will follow
          } else if (parsed.type === 'run.completed' && parsed.answer) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: parsed.answer,
              };
              return updated;
            });
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error || 'Chat failed');
          } else if (parsed.text) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + parsed.text,
              };
              return updated;
            });
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== 'Unexpected token') {
            throw parseErr;
          }
          // plain text chunk
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          });
        }
      }
    } catch (err) {
      toast.error('Chat failed', { description: err instanceof Error ? err.message : 'Unknown error' });
      setMessages(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.streaming) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false, content: updated[updated.length - 1].content || 'Failed to get response' };
        }
        return updated;
      });
    } finally {
      setMessages(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.streaming) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false };
        }
        return updated;
      });
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-h2 text-text-primary">Chat</h1>
          <p className="text-caption text-text-secondary">Multi-turn conversation with AI</p>
        </div>
        <button
          onClick={() => setAgentMode(!agentMode)}
          className={cn('btn-secondary', agentMode && '!bg-accent-secondary/10 !border-accent-secondary !text-accent-secondary')}
        >
          <Bot className="w-4 h-4" />
          {agentMode ? 'Agent Mode' : 'Chat Mode'}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-card bg-elevated flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-h3 text-text-primary mb-1">Start a conversation</h3>
            <p className="text-small text-text-secondary">Send a message to begin chatting with the AI</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-3 max-w-3xl', msg.role === 'user' && 'ml-auto flex-row-reverse')}>
              <div className={cn(
                'w-8 h-8 rounded-full shrink-0 flex items-center justify-center',
                msg.role === 'user' ? 'bg-accent-primary/10' : 'bg-accent-secondary/10',
              )}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-accent-primary" /> : <Bot className="w-4 h-4 text-accent-secondary" />}
              </div>
              <div className={cn(
                'rounded-card px-4 py-3 max-w-full',
                msg.role === 'user' ? 'bg-accent-primary/10 text-text-primary' : 'bg-surface text-text-primary',
              )}>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.content || (msg.streaming && <Loader2 className="w-4 h-4 animate-spin text-text-muted" />)}
                  {msg.streaming && msg.content && <span className="inline-block w-1.5 h-4 bg-accent-primary ml-0.5 animate-pulse-soft" />}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border-subtle shrink-0">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <button className="btn-icon mb-0.5" title="Attach file">
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="input flex-1 resize-none max-h-32"
            style={{ minHeight: '40px' }}
          />
          {isStreaming ? (
            <button onClick={handleStop} className="btn-secondary mb-0.5">
              Stop
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()} className="btn-primary mb-0.5">
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
