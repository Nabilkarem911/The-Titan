import { useState, useEffect } from 'react';
import { Brain, MessageSquare, Search, Clock, User, Bot, AlertCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ChatSession {
  sessionId: string;
  lastMessage: string;
  lastRole: string;
  updatedAt: string;
  count: number;
}

import { API_BASE, getToken } from '../api/client';

export default function MemoryPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      // Derive sessions from history by fetching with different agent IDs
      // For now, just fetch default agent history and derive session
      const res = await fetch(`${API_BASE}/chat/history?limit=200`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { sessionId: string; messages: ChatMessage[] };

      // Group by session
      const map = new Map<string, ChatMessage[]>();
      for (const m of data.messages) {
        const list = map.get(data.sessionId) ?? [];
        list.push(m);
        map.set(data.sessionId, list);
      }

      const list: ChatSession[] = [];
      for (const [sid, msgs] of map.entries()) {
        const last = msgs[msgs.length - 1];
        list.push({
          sessionId: sid,
          lastMessage: last?.content.slice(0, 120) ?? '',
          lastRole: last?.role ?? 'user',
          updatedAt: last?.createdAt ?? new Date().toISOString(),
          count: msgs.length,
        });
      }
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setSessions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/chat/history?sessionId=${encodeURIComponent(sessionId)}&limit=200`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { messages: ChatMessage[] };
      setMessages(data.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) fetchMessages(selectedSession);
  }, [selectedSession]);

  const filtered = sessions.filter((s) =>
    s.lastMessage.toLowerCase().includes(search.toLowerCase()) ||
    s.sessionId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-500/20 text-violet-400">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Memory</h3>
            <p className="text-xs text-slate-500">Chat history and agent memory sessions</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions..." className="input pl-9" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Session List */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Brain className="h-10 w-10 mb-2 text-slate-600" />
              <p className="text-sm">No sessions found</p>
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.sessionId}
                onClick={() => setSelectedSession(s.sessionId)}
                className={`card p-3 cursor-pointer hover:bg-slate-800/40 transition-colors ${selectedSession === s.sessionId ? 'ring-1 ring-indigo-500/40' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-xs font-medium text-slate-300 truncate">{s.sessionId.split(':').pop()}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-1.5">{s.lastMessage}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-600">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(s.updatedAt).toLocaleDateString()}</span>
                  <span>{s.count} msgs</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Messages */}
        <div className="lg:col-span-2 card space-y-3 max-h-[600px] overflow-y-auto">
          {selectedSession ? (
            messages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No messages in this session</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`flex-1 p-3 rounded-xl text-xs ${m.role === 'user' ? 'bg-indigo-500/10 text-indigo-200' : 'bg-slate-800/60 text-slate-300'}`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <div className="text-[10px] text-slate-500 mt-1.5">{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Brain className="h-8 w-8 mb-2 text-slate-600" />
              <p className="text-sm">Select a session to view messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
