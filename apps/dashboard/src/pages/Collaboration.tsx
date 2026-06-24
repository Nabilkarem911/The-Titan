import { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, RefreshCw, Plus, MessageSquare, CheckCircle } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface CollaborationSession {
  sessionId: string;
  topic: string;
  agents: number;
  messages: number;
  status: string;
  createdAt: string;
}

interface CollaborationStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  totalMessages: number;
  totalAgents: number;
}

export default function Collaboration() {
  const [sessions, setSessions] = useState<CollaborationSession[]>([]);
  const [stats, setStats] = useState<CollaborationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        api.get<{ sessions: CollaborationSession[] }>('/collaboration/sessions').catch(() => ({ sessions: [] })),
        api.get<CollaborationStats>('/collaboration/stats').catch(() => null),
      ]);
      setSessions(sessionsRes.sessions ?? []);
      setStats(statsRes);
    } catch {
      toast.error('Failed to load collaboration data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!topic.trim()) return;
    setCreating(true);
    try {
      await api.post('/collaboration/sessions', { topic, description });
      toast.success('Collaboration session created');
      setTopic('');
      setDescription('');
      await load();
    } catch {
      toast.error('Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="collaboration"
        icon={Users}
        title="Collaboration Sessions"
        subtitle="Multi-agent collaboration, live sessions, and consensus building"
        description="Collaboration sessions allow multiple agents to work together on a shared topic. Agents join sessions, exchange messages, and build consensus. Use this page to create sessions, monitor live activity, and view completed consensus outcomes."
        tips={[
          'Create a session with a topic and invite agents to join',
          'Agents exchange messages and build toward consensus',
          'Completed sessions show the final consensus result',
          'From chat: titan chat "start a collaboration session about X"',
        ]}
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-accent-primary" /><span className="text-small text-text-secondary">Total Sessions</span></div>
            <p className="text-h2 font-bold text-text-primary">{stats.totalSessions}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4 text-accent-secondary" /><span className="text-small text-text-secondary">Active</span></div>
            <p className="text-h2 font-bold text-text-primary">{stats.activeSessions}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-success" /><span className="text-small text-text-secondary">Completed</span></div>
            <p className="text-h2 font-bold text-text-primary">{stats.completedSessions}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4 text-accent-tertiary" /><span className="text-small text-text-secondary">Total Messages</span></div>
            <p className="text-h2 font-bold text-text-primary">{stats.totalMessages}</p>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-4">Create Collaboration Session</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Session topic..."
            className="input w-full"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="input w-full"
          />
          <button onClick={handleCreate} disabled={creating || !topic.trim()} className="btn-primary flex items-center gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Session
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-h3 text-text-primary">Active Sessions ({sessions.length})</h2>
        </div>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-8 h-8 text-text-muted mb-2" />
            <p className="text-small text-text-secondary">No collaboration sessions yet — create one above</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {sessions.map((session) => (
              <div key={session.sessionId} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary">{session.topic}</span>
                  <span className={`badge text-caption ${session.status === 'completed' ? 'bg-success/10 text-success' : session.status === 'failed' ? 'bg-error/10 text-error' : 'bg-accent-primary/10 text-accent-primary'}`}>{session.status}</span>
                </div>
                <div className="flex gap-4 text-caption text-text-muted">
                  <span>{session.agents} agents</span>
                  <span>{session.messages} messages</span>
                  <span>{new Date(session.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
