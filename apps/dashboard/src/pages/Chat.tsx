import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, StopCircle, Trash2, Plus } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { classNames, formatRelativeTime } from '../utils/format';
import { ErrorState } from '../components/PageState';
import type { AgentProfile, ChatMessage } from '../api/client';

export default function Chat() {
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { data: agents, error, isLoading, refetch } = useApi<AgentProfile[]>(
    () => api.getAgents(),
    []
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0].id);
    }
  }, [agents, selectedAgent]);

  const stopStreaming = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (streamContent) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: streamContent,
          created_at: new Date().toISOString(),
        },
      ]);
      setStreamContent('');
    }
    setIsStreaming(false);
  }, [streamContent]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || !selectedAgent || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setStreamContent('');

    try {
      const es = api.streamChat(selectedAgent, msg, conversationId);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.conversation_id && !conversationId) {
            setConversationId(data.conversation_id);
          }
          if (data.content) {
            setStreamContent((prev) => prev + data.content);
          }
          if (data.done) {
            es.close();
            eventSourceRef.current = null;
            setMessages((prev) => [
              ...prev,
              {
                id: data.message_id || `msg-${Date.now()}`,
                role: 'assistant',
                content: data.full_content || '',
                tokens: data.tokens,
                created_at: new Date().toISOString(),
              },
            ]);
            setStreamContent('');
            setIsStreaming(false);
          }
        } catch {
          // partial data
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
        if (streamContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: streamContent || 'Connection lost.',
              created_at: new Date().toISOString(),
            },
          ]);
          setStreamContent('');
        }
      };
    } catch {
      setIsStreaming(false);
      try {
        const result = await api.sendMessage(selectedAgent, msg, conversationId);
        setConversationId(result.conversation_id);
        setMessages((prev) => [...prev, result.message]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : 'Failed to send message'}`,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    }
  }, [input, selectedAgent, isStreaming, conversationId, streamContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const newChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setStreamContent('');
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    inputRef.current?.focus();
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Chat header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="input w-64"
          disabled={isLoading}
        >
          {isLoading && <option>Loading agents...</option>}
          {agents?.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name}</option>
          ))}
        </select>
        <button onClick={newChat} className="btn btn-secondary btn-sm">
          <Plus className="w-4 h-4" />
          New Chat
        </button>
        {messages.length > 0 && (
          <button onClick={newChat} className="btn btn-ghost btn-sm text-text-muted">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Bot className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-muted text-sm">
                Start a conversation with your agent
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && streamContent && (
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-[rgba(0,242,254,0.1)] flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary whitespace-pre-wrap">{streamContent}</div>
                  <div className="w-2 h-4 bg-cyan animate-pulse inline-block ml-0.5" />
                </div>
              </div>
            )}
            {isStreaming && !streamContent && (
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-lg bg-[rgba(0,242,254,0.1)] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-cyan" />
                </div>
                <Loader2 className="w-4 h-4 text-cyan animate-spin" />
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border pt-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="input flex-1 resize-none min-h-[44px] max-h-32"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button onClick={stopStreaming} className="btn btn-danger px-3 py-2.5">
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedAgent}
              className="btn btn-primary px-3 py-2.5"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-text-muted mt-2">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={classNames('flex gap-3 items-start', isUser && 'flex-row-reverse')}>
      <div
        className={classNames(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          isUser ? 'bg-[rgba(112,0,255,0.1)]' : 'bg-[rgba(0,242,254,0.1)]'
        )}
      >
        {isUser ? <User className="w-4 h-4 text-violet" /> : <Bot className="w-4 h-4 text-cyan" />}
      </div>
      <div className={classNames('flex-1 min-w-0', isUser && 'text-end')}>
        <div
          className={classNames(
            'inline-block rounded-xl px-4 py-2.5 text-sm max-w-[85%] text-start',
            isUser
              ? 'bg-[rgba(112,0,255,0.12)] text-text-primary'
              : 'bg-card text-text-primary border border-border'
          )}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
        <div className="text-[10px] text-text-muted mt-1 px-1">
          {formatRelativeTime(message.created_at)}
          {message.tokens ? ` · ${message.tokens} tokens` : ''}
        </div>
      </div>
    </div>
  );
}
