import { useState, useEffect, useCallback } from 'react';
import { Globe, Loader2, RefreshCw, Send } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface A2AStats {
  totalAgents: number;
  healthyAgents: number;
  totalTasks: number;
  tasksByState: Record<string, number>;
  capabilities: Array<{ capability: string; count: number }>;
}

export default function AgentNetwork() {
  const [stats, setStats] = useState<A2AStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetAgent, setTargetAgent] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<A2AStats>('/a2a/stats');
      setStats(res);
    } catch {
      toast.error('Failed to load A2A network data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!targetAgent.trim() || !message.trim()) return;
    setSending(true);
    try {
      await api.post('/a2a/tasks', { agentId: targetAgent, name: 'message', description: 'Chat message', content: message });
      toast.success('Message sent to agent');
      setMessage('');
    } catch {
      toast.error('Failed to send A2A message');
    } finally {
      setSending(false);
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
        pageKey="agentNetwork"
        icon={Globe}
        title="Agent Network (A2A)"
        subtitle="Agent-to-agent communication protocol, web MCP bridge, and screen monitor"
        description="The Agent Network enables Titan instances to communicate with each other using the A2A (Agent-to-Agent) protocol. Agents can discover each other's capabilities, exchange skills, delegate tasks, and share knowledge. This is the foundation for multi-agent collaboration and the Hive Mind. Use this page to view connected agents, send messages, and browse available capabilities."
        tips={[
          'Use the message form below to send a task to another Titan agent',
          'Capabilities show what each agent can do — useful for task delegation',
          'From chat: titan chat "send a translation task to Claude agent"',
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
            <span className="text-small text-text-secondary">Total Agents</span>
            <p className="text-h2 font-bold text-text-primary">{stats.totalAgents}</p>
          </div>
          <div className="card p-5">
            <span className="text-small text-text-secondary">Healthy</span>
            <p className="text-h2 font-bold text-success">{stats.healthyAgents}</p>
          </div>
          <div className="card p-5">
            <span className="text-small text-text-secondary">Total Tasks</span>
            <p className="text-h2 font-bold text-text-primary">{stats.totalTasks}</p>
          </div>
          <div className="card p-5">
            <span className="text-small text-text-secondary">Capabilities</span>
            <p className="text-h2 font-bold text-text-primary">{stats.capabilities?.length ?? 0}</p>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-4">Send A2A Message</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={targetAgent}
            onChange={(e) => setTargetAgent(e.target.value)}
            placeholder="Target agent ID"
            className="input w-full"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message to send..."
            className="input w-full min-h-[80px]"
          />
          <button onClick={handleSend} disabled={sending || !targetAgent.trim() || !message.trim()} className="btn-primary flex items-center gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </div>
      </div>

      {stats?.capabilities && stats.capabilities.length > 0 && (
        <div className="card p-5">
          <h2 className="text-h3 text-text-primary mb-3">Agent Capabilities</h2>
          <div className="flex flex-wrap gap-2">
            {stats.capabilities.map((c) => (
              <span key={c.capability} className="badge bg-accent-primary/10 text-accent-primary">{c.capability} ({c.count})</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
