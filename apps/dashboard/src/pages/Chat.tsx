import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Bot, User, Loader2, Square, Plus, ChevronDown, Wrench, Brain, Eye, MessageSquare, RefreshCw, Download, X, FileText, Image as ImageIcon, ThumbsUp, ThumbsDown, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

interface StepData {
  index: number;
  status: string;
  thought?: string;
  actionName?: string;
  actionParams?: Record<string, unknown>;
  observationSuccess?: boolean;
  observationData?: unknown;
  observationError?: string;
  reflection?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  steps?: StepData[];
  attachments?: Array<{ name: string; type: string; content: string }>;
  feedback?: 'up' | 'down' | null;
  _idx?: number;
}

function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-accent-primary/30 text-text-primary rounded px-0.5">{part}</mark>
      : part
  );
}

interface ChatSession {
  sessionId: string;
  lastMessage: string;
  lastRole: string;
  messageCount: number;
  updatedAt: string;
}

export default function Chat() {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('titan:chatModel') || 'default');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; content: string }>>([]);
  const [lastUserPrompt, setLastUserPrompt] = useState<string>('');
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down' | null>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await api.get<{ items: ChatSession[]; total: number }>('/chat/sessions');
      setSessions(res.items);
    } catch {
      /* ignore */
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Initialize session from localStorage or create new one
  useEffect(() => {
    const saved = localStorage.getItem('titan:chatSessionId');
    if (saved && userId) {
      const expectedPrefix = `session:${userId}:`;
      if (saved.startsWith(expectedPrefix)) {
        setSessionId(saved);
        // Load history for this session
        api.get<{ items: Array<{ role: string; content: string }>; total: number }>(`/chat/history/${encodeURIComponent(saved)}`)
          .then((res) => {
            setMessages(res.items.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })));
          })
          .catch(() => {
            // If fetch fails, start fresh
            const newId = `session:${userId}:default-agent`;
            setSessionId(newId);
            localStorage.setItem('titan:chatSessionId', newId);
          })
          .finally(() => setHistoryLoading(false));
        loadSessions();
        return;
      }
    }
    // No saved session — create new one
    if (userId) {
      const newId = `session:${userId}:default-agent`;
      setSessionId(newId);
      localStorage.setItem('titan:chatSessionId', newId);
    }
    setHistoryLoading(false);
    loadSessions();
  }, [userId, loadSessions]);

  const handleNewChat = useCallback(() => {
    if (isStreaming) return;
    if (!userId) return;
    const newId = `session:${userId}:default-agent-${Date.now()}`;
    setSessionId(newId);
    localStorage.setItem('titan:chatSessionId', newId);
    setMessages([]);
  }, [userId, isStreaming]);

  const handleSelectSession = useCallback(async (sid: string) => {
    if (isStreaming) return;
    setSessionId(sid);
    localStorage.setItem('titan:chatSessionId', sid);
    setHistoryLoading(true);
    try {
      const res = await api.get<{ items: Array<{ role: string; content: string }>; total: number }>(`/chat/history/${encodeURIComponent(sid)}`);
      setMessages(res.items.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })));
    } catch {
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [isStreaming]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowModelDropdown(false);
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const sendBtn = document.querySelector('[data-send-btn]') as HTMLButtonElement | null;
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
      }
      if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSearch(s => !s);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Filtered messages for search
  const filteredMessages = searchQuery.trim()
    ? messages.map((m, i) => ({ ...m, _idx: i })).filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const handleFeedback = (msgIndex: number, type: 'up' | 'down') => {
    setFeedback(prev => {
      const current = prev[msgIndex];
      const next = current === type ? null : type;
      return { ...prev, [msgIndex]: next };
    });
    if (type === 'up') toast.success('Thanks for the feedback!');
    else toast.info('Feedback noted — will help improve responses');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAttachments: Array<{ name: string; type: string; content: string }> = [];
    for (const file of Array.from(files).slice(0, 3)) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (max 5MB)`);
        continue;
      }
      try {
        const content = await file.text();
        newAttachments.push({ name: file.name, type: file.type || 'text/plain', content });
      } catch {
        newAttachments.push({ name: file.name, type: file.type || 'application/octet-stream', content: `[Binary file: ${file.size} bytes]` });
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleExport = (format: 'markdown' | 'json') => {
    if (messages.length === 0) {
      toast.error('No messages to export');
      return;
    }
    let content: string;
    let filename: string;
    if (format === 'json') {
      content = JSON.stringify(messages.map(m => ({ role: m.role, content: m.content, steps: m.steps, attachments: m.attachments })), null, 2);
      filename = `titan-chat-${new Date().toISOString().slice(0, 10)}.json`;
    } else {
      content = messages.map(m => {
        const header = m.role === 'user' ? '**User**' : '**Assistant**';
        const steps = m.steps && m.steps.length > 0
          ? m.steps.map(s => `  \n  - Step ${s.index + 1}: ${s.status}${s.actionName ? ` (${s.actionName})` : ''}${s.thought ? `\n    Thought: ${s.thought}` : ''}`).join('')
          : '';
        const atts = m.attachments && m.attachments.length > 0
          ? m.attachments.map(a => `  \n  - Attached: ${a.name} (${a.type})`).join('')
          : '';
        return `### ${header}\n${m.content}${steps}${atts}\n`;
      }).join('\n---\n\n');
      filename = `titan-chat-${new Date().toISOString().slice(0, 10)}.md`;
    }
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const handleRegenerate = async () => {
    if (isStreaming || !lastUserPrompt) return;
    // Remove last assistant message
    setMessages(prev => {
      const updated = [...prev];
      if (updated[updated.length - 1]?.role === 'assistant') {
        updated.pop();
      }
      return updated;
    });
    // Re-send the last user prompt
    const userMsg: Message = { role: 'user', content: lastUserPrompt };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, assistantMsg]);
    try {
      abortRef.current = new AbortController();
      for await (const chunk of api.stream('/chat', {
        prompt: lastUserPrompt,
        agentId: 'default-agent',
        sessionId: sessionId ?? undefined,
        stream: true,
        ...(selectedModel !== 'default' && { model: selectedModel }),
      }, abortRef.current.signal)) {
        try {
          const parsed = JSON.parse(chunk);
          if (parsed.type === 'step' && parsed.step) {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                last.steps = [...(last.steps ?? []), parsed.step];
              }
              return [...updated];
            });
          } else if (parsed.type === 'run.completed' && parsed.answer) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: parsed.answer };
              return updated;
            });
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error || 'Chat failed');
          } else if (parsed.text) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + parsed.text };
              return updated;
            });
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== 'Unexpected token') throw parseErr;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + chunk };
            return updated;
          });
        }
      }
    } catch (err) {
      toast.error('Regenerate failed', { description: err instanceof Error ? err.message : 'Unknown error' });
      setMessages(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.streaming) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false, content: 'Failed to regenerate response' };
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

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { role: 'user', content: input.trim(), attachments: attachments.length > 0 ? attachments : undefined };
    setLastUserPrompt(input.trim());
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setIsStreaming(true);

    // Build prompt with file context
    let promptText = userMsg.content;
    if (attachments.length > 0) {
      const fileContext = attachments.map(a => `\n[Attached file: ${a.name} (${a.type})]\n${a.content.slice(0, 10000)}`).join('\n');
      promptText = `${userMsg.content}\n${fileContext}`;
    }

    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      abortRef.current = new AbortController();
      for await (const chunk of api.stream('/chat', {
        prompt: promptText,
        agentId: 'default-agent',
        sessionId: sessionId ?? undefined,
        stream: true,
        ...(selectedModel !== 'default' && { model: selectedModel }),
      }, abortRef.current.signal)) {
        try {
          const parsed = JSON.parse(chunk);
          if (parsed.type === 'run.started') {
            // runId received, streaming will follow
          } else if (parsed.type === 'step' && parsed.step) {
            // Add step to current assistant message
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                last.steps = [...(last.steps ?? []), parsed.step];
              }
              return [...updated];
            });
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
    <div className="flex h-full">
      {/* Sessions Sidebar */}
      <div className="w-64 shrink-0 border-r border-border-subtle flex flex-col">
        <div className="p-3 border-b border-border-subtle">
          <button
            onClick={handleNewChat}
            disabled={isStreaming || historyLoading}
            className="btn-primary w-full flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-caption text-text-muted text-center py-4">No previous chats</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.sessionId}
                onClick={() => handleSelectSession(s.sessionId)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-btn transition-colors group',
                  s.sessionId === sessionId ? 'bg-accent-primary/10' : 'hover:bg-elevated',
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', s.sessionId === sessionId ? 'text-accent-primary' : 'text-text-muted')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-caption text-text-primary truncate">
                      {s.lastMessage || 'Empty chat'}
                    </p>
                    <p className="text-caption text-text-muted mt-0.5">
                      {s.messageCount} msgs
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-h2 text-text-primary">Chat</h1>
          <p className="text-caption text-text-secondary">Multi-turn conversation with AI</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export buttons */}
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSearch(s => !s)} className="btn-icon" title="Search (Ctrl+/)">
              <Search className="w-4 h-4" />
            </button>
            <button onClick={() => handleExport('markdown')} disabled={messages.length === 0} className="btn-icon" title="Export as Markdown">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={() => handleExport('json')} disabled={messages.length === 0} className="btn-icon" title="Export as JSON">
              <Download className="w-4 h-4" />
            </button>
          </div>
          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <Bot className="w-4 h-4" />
              {selectedModel === 'default' ? 'Auto' : selectedModel}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showModelDropdown && (
              <div className="absolute right-0 mt-1 w-48 card p-1 z-20 shadow-xl">
                {['default', 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'claude-3-haiku'].map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedModel(m);
                      localStorage.setItem('titan:chatModel', m);
                      setShowModelDropdown(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 rounded-btn text-sm transition-colors',
                      m === selectedModel ? 'bg-accent-primary/10 text-accent-primary' : 'hover:bg-elevated text-text-secondary',
                    )}
                  >
                    {m === 'default' ? 'Auto (default)' : m}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={cn('btn-secondary', agentMode && '!bg-accent-secondary/10 !border-accent-secondary !text-accent-secondary')}
          >
            <Bot className="w-4 h-4" />
            {agentMode ? 'Agent Mode' : 'Chat Mode'}
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-6 py-3 border-b border-border-subtle shrink-0">
          <div className="relative max-w-3xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)}
              placeholder="Search messages..."
              className="input pl-9"
            />
            {filteredMessages && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption text-text-muted">
                {filteredMessages.length} found
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {historyLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-card bg-elevated flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-h3 text-text-primary mb-1">Start a conversation</h3>
            <p className="text-small text-text-secondary">Send a message to begin chatting with the AI</p>
          </div>
        ) : filteredMessages ? (
          filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Search className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No messages found for "{searchQuery}"</p>
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div key={msg._idx} className={cn('flex gap-3 max-w-3xl', msg.role === 'user' && 'ml-auto flex-row-reverse')}>
                <div className={cn(
                  'w-8 h-8 rounded-full shrink-0 flex items-center justify-center',
                  msg.role === 'user' ? 'bg-accent-primary/10' : 'bg-accent-secondary/10',
                )}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-accent-primary" /> : <Bot className="w-4 h-4 text-accent-secondary" />}
                </div>
                <div className={cn(
                  'rounded-card px-4 py-3 max-w-full flex-1',
                  msg.role === 'user' ? 'bg-accent-primary/10 text-text-primary' : 'bg-surface text-text-primary',
                )}>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {highlightSearch(msg.content, searchQuery)}
                  </p>
                </div>
              </div>
            ))
          )
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
                'rounded-card px-4 py-3 max-w-full flex-1',
                msg.role === 'user' ? 'bg-accent-primary/10 text-text-primary' : 'bg-surface text-text-primary',
              )}>
                {/* Render steps before content for assistant messages */}
                {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && (
                  <StepCards steps={msg.steps} />
                )}
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.content || (msg.streaming && (!msg.steps || msg.steps.length === 0) && <Loader2 className="w-4 h-4 animate-spin text-text-muted" />)}
                  {msg.streaming && msg.content && <span className="inline-block w-1.5 h-4 bg-accent-primary ml-0.5 animate-pulse-soft" />}
                </p>
                {/* Regenerate + Feedback buttons for last assistant message */}
                {msg.role === 'assistant' && !msg.streaming && i === messages.length - 1 && !isStreaming && (
                  <div className="mt-2 pt-2 border-t border-border-subtle flex items-center gap-3">
                    <button onClick={handleRegenerate} className="flex items-center gap-1 text-caption text-text-muted hover:text-accent-primary transition-colors">
                      <RefreshCw className="w-3 h-3" />
                      Regenerate
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleFeedback(i, 'up')}
                        className={cn('p-1 rounded-btn transition-colors', feedback[i] === 'up' ? 'text-success' : 'text-text-muted hover:text-success')}
                        title="Good response"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(i, 'down')}
                        className={cn('p-1 rounded-btn transition-colors', feedback[i] === 'down' ? 'text-error' : 'text-text-muted hover:text-error')}
                        title="Bad response"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
                {/* Attachments display */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.attachments.map((att, ai) => (
                      <span key={ai} className="badge bg-elevated text-text-secondary text-caption flex items-center gap-1">
                        {att.type.startsWith('image/') ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {att.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border-subtle shrink-0">
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 max-w-3xl mx-auto">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-btn bg-elevated border border-border-subtle">
                {att.type.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-accent-secondary" /> : <FileText className="w-3.5 h-3.5 text-accent-secondary" />}
                <span className="text-caption text-text-secondary max-w-[120px] truncate">{att.name}</span>
                <button onClick={() => removeAttachment(idx)} className="text-text-muted hover:text-error">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept=".txt,.md,.json,.js,.ts,.tsx,.py,.go,.rs,.java,.c,.cpp,.h,.css,.html,.xml,.yaml,.yml,.csv,.log,.png,.jpg,.jpeg,.gif,.webp,.svg" />
          <button onClick={() => fileInputRef.current?.click()} className="btn-icon mb-0.5" title="Attach file">
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
            <button onClick={handleStop} className="btn-secondary mb-0.5 flex items-center gap-1.5">
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()} data-send-btn className="btn-primary mb-0.5">
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function StepCards({ steps }: { steps: StepData[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (idx: number) => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const stepIcon = (status: string) => {
    if (status === 'executing') return <Wrench className="w-3.5 h-3.5 text-accent-secondary" />;
    if (status === 'reflecting') return <Eye className="w-3.5 h-3.5 text-text-muted" />;
    return <Brain className="w-3.5 h-3.5 text-accent-primary" />;
  };

  const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n) + '...' : s;

  return (
    <div className="mb-3 space-y-1.5">
      <div className="text-caption text-text-muted uppercase tracking-wider font-medium mb-1">Agent Steps</div>
      {steps.map((step) => (
        <div key={step.index} className="border border-border-subtle rounded-btn overflow-hidden">
          <button
            onClick={() => toggle(step.index)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elevated transition-colors text-left"
          >
            {stepIcon(step.status)}
            <span className="text-caption text-text-secondary font-medium">Step {step.index + 1}</span>
            <span className="badge bg-elevated text-text-muted text-caption ml-1">{step.status}</span>
            {step.actionName && (
              <span className="badge bg-accent-secondary/10 text-accent-secondary text-caption ml-1 font-mono">{step.actionName}</span>
            )}
            {step.observationSuccess === true && (
              <span className="badge bg-success/10 text-success text-caption ml-1">✓</span>
            )}
            {step.observationSuccess === false && (
              <span className="badge bg-error/10 text-error text-caption ml-1">✗</span>
            )}
            {step.latencyMs != null && (
              <span className="text-caption text-text-muted ml-auto">{step.latencyMs}ms</span>
            )}
            <ChevronDown className={cn('w-3.5 h-3.5 text-text-muted transition-transform shrink-0', expanded[step.index] && 'rotate-180')} />
          </button>
          {expanded[step.index] && (
            <div className="px-3 py-2 border-t border-border-subtle space-y-2 bg-void/30">
              {step.thought && (
                <div>
                  <span className="text-caption text-text-muted font-medium">Thought:</span>
                  <p className="text-caption text-text-secondary italic mt-0.5">{step.thought}</p>
                </div>
              )}
              {step.actionName && step.actionParams && Object.keys(step.actionParams).length > 0 && (
                <div>
                  <span className="text-caption text-text-muted font-medium">Parameters:</span>
                  <pre className="text-caption text-text-secondary mt-0.5 p-2 bg-surface rounded font-mono overflow-x-auto">{JSON.stringify(step.actionParams, null, 2)}</pre>
                </div>
              )}
              {step.observationError && (
                <div>
                  <span className="text-caption text-error font-medium">Error:</span>
                  <p className="text-caption text-error mt-0.5">{step.observationError}</p>
                </div>
              )}
              {step.observationData != null && (
                <div>
                  <span className="text-caption text-text-muted font-medium">Result:</span>
                  <pre className="text-caption text-text-secondary mt-0.5 p-2 bg-surface rounded font-mono overflow-x-auto max-h-40 overflow-y-auto">{truncate(JSON.stringify(step.observationData, null, 2), 2000)}</pre>
                </div>
              )}
              {step.reflection && (
                <div>
                  <span className="text-caption text-text-muted font-medium">Reflection:</span>
                  <p className="text-caption text-text-secondary mt-0.5">{step.reflection}</p>
                </div>
              )}
              {step.tokensUsed != null && (
                <div className="text-caption text-text-muted">Tokens: {step.tokensUsed}</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
