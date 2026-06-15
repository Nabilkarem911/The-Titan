import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Wrench, Brain, AlertCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  steps?: StepInfo[];
  tokensUsed?: number;
}

interface StepInfo {
  index: number;
  status: string;
  thought: string | null;
  actionName: string | null;
  actionParams?: unknown;
  observationSuccess?: boolean | null;
  observationError?: string | null;
  reflection: string | null;
  tokensUsed: number | null;
  latencyMs: number | null;
}

const API_BASE = ((import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL) ?? '/api/v1';

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<StepInfo[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentSteps, streamingText, scrollToBottom]);

  const getToken = () => localStorage.getItem('titan_access_token') ?? '';

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    setInput('');
    setError(null);
    setCurrentSteps([]);
    setStreamingText('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          prompt,
          stream: true,
          maxSteps: 10,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      const steps: StepInfo[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const event = JSON.parse(data);

            if (event.type === 'step') {
              steps.push(event.step);
              setCurrentSteps([...steps]);
            } else if (event.type === 'run.completed') {
              const assistantMsg: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: event.answer,
                timestamp: new Date(),
                steps: [...steps],
                tokensUsed: event.tokensUsed,
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setCurrentSteps([]);
              setStreamingText('');
            } else if (event.type === 'error') {
              setError(event.error);
            } else if (event.text) {
              setStreamingText((prev) => prev + event.text);
            }
          } catch {
            // skip invalid JSON
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <Bot className="h-6 w-6 text-indigo-400" />
        <h1 className="text-xl font-semibold text-white">Chat</h1>
        <span className="text-xs text-slate-500 ml-auto">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-12 w-12 text-slate-700 mb-4" />
            <p className="text-slate-500 text-lg">Start a conversation with Titan</p>
            <p className="text-slate-600 text-sm mt-2">
              Ask questions, request tasks, or explore agent capabilities
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming / In-progress indicator */}
        {isLoading && (
          <div className="space-y-2">
            {currentSteps.length > 0 && (
              <div className="ml-10 space-y-1">
                {currentSteps.map((step, i) => (
                  <StepIndicator key={i} step={step} />
                ))}
              </div>
            )}
            {streamingText && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-600/20 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="flex-1 rounded-xl bg-slate-800/50 border border-slate-700 px-4 py-3">
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{streamingText}</p>
                </div>
              </div>
            )}
            {!streamingText && currentSteps.length === 0 && (
              <div className="flex gap-3 items-center ml-10">
                <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                <span className="text-sm text-slate-500">Thinking...</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex gap-2 items-center ml-10 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 pt-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for newline)"
            className="input resize-none min-h-[44px] max-h-[200px]"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="btn-primary h-[44px] px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const [showSteps, setShowSteps] = useState(false);

  return (
    <div className="space-y-1">
      <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
        {!isUser && (
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-600/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-indigo-400" />
          </div>
        )}
        <div
          className={`max-w-[80%] rounded-xl px-4 py-3 ${
            isUser
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800/50 border border-slate-700 text-slate-200'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {!isUser && message.tokensUsed && (
            <p className="text-xs text-slate-500 mt-2">{message.tokensUsed} tokens</p>
          )}
        </div>
        {isUser && (
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
            <User className="h-4 w-4 text-slate-300" />
          </div>
        )}
      </div>

      {/* Steps toggle */}
      {!isUser && message.steps && message.steps.length > 0 && (
        <div className="ml-11">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
          >
            <Brain className="h-3 w-3" />
            {showSteps ? 'Hide' : 'Show'} {message.steps.length} thinking steps
          </button>
          {showSteps && (
            <div className="mt-2 space-y-1">
              {message.steps.map((step, i) => (
                <StepIndicator key={i} step={step} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: StepInfo }) {
  return (
    <div className="flex items-start gap-2 text-xs border-l-2 border-slate-700 pl-3 py-1">
      <div className="flex-shrink-0 mt-0.5">
        {step.actionName ? (
          <Wrench className="h-3 w-3 text-amber-400" />
        ) : (
          <Brain className="h-3 w-3 text-indigo-400" />
        )}
      </div>
      <div className="space-y-0.5">
        {step.thought && (
          <p className="text-slate-400">
            <span className="text-slate-500">Think:</span> {step.thought.slice(0, 120)}
            {step.thought.length > 120 ? '...' : ''}
          </p>
        )}
        {step.actionName && (
          <p className="text-amber-400/80">
            <span className="text-slate-500">Tool:</span> {step.actionName}
            {step.observationSuccess === false && (
              <span className="text-red-400 ml-1">✗</span>
            )}
            {step.observationSuccess === true && (
              <span className="text-green-400 ml-1">✓</span>
            )}
          </p>
        )}
        {step.reflection && (
          <p className="text-slate-500">
            <span className="text-slate-600">Reflect:</span> {step.reflection.slice(0, 100)}
            {step.reflection.length > 100 ? '...' : ''}
          </p>
        )}
        {step.latencyMs && (
          <span className="text-slate-600">{step.latencyMs}ms</span>
        )}
      </div>
    </div>
  );
}
