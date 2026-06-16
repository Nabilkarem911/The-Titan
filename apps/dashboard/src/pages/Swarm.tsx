import { useState, useEffect } from 'react';
import {
  Bug,
  Plus,
  Rocket,
  Search,
  AlertCircle,
  ChevronRight,
  CheckCircle,
  Clock,
  XCircle,
  Users,
  Zap,
  BarChart3,
} from 'lucide-react';

interface SwarmTask {
  id: string;
  description: string;
  status: string;
  agentsCount: number;
  subTasksCount: number;
  completedSubTasks: number;
  finalAnswer: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SwarmAgent {
  id: string;
  role: string;
  name: string;
  description: string;
  systemPrompt?: string;
  allowedTools?: string[];
  maxSteps?: number;
  priority?: number;
}

interface SwarmSubTask {
  id: string;
  agentRole: string;
  status: string;
  prompt: string;
  result: string | null;
  runId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SwarmDetail {
  id: string;
  description: string;
  originalPrompt: string;
  status: string;
  finalAnswer: string | null;
  agents: Array<{ id: string; role: string; name: string }>;
  subTasks: SwarmSubTask[];
  createdAt: string;
  updatedAt: string;
}

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? '/api/v1';
const getToken = () => localStorage.getItem('titan_access_token') ?? '';

const ROLES = ['planner', 'researcher', 'coder', 'reviewer', 'executor', 'synthesizer'] as const;

const ROLE_COLORS: Record<string, string> = {
  planner: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  researcher: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  coder: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  reviewer: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  executor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  synthesizer: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export default function SwarmPage() {
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [detail, setDetail] = useState<SwarmDetail | null>(null);
  const [showLaunch, setShowLaunch] = useState(false);

  // Launch form
  const [desc, setDesc] = useState('');
  const [prompt, setPrompt] = useState('');
  const [agents, setAgents] = useState<SwarmAgent[]>([
    { id: crypto.randomUUID(), role: 'planner', name: 'Planner', description: 'Breaks down the task into subtasks', maxSteps: 10, priority: 0 },
    { id: crypto.randomUUID(), role: 'coder', name: 'Coder', description: 'Writes code and implements solutions', maxSteps: 15, priority: 1 },
    { id: crypto.randomUUID(), role: 'reviewer', name: 'Reviewer', description: 'Reviews and validates outputs', maxSteps: 10, priority: 2 },
  ]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/swarm/tasks`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: SwarmTask[] };
      setTasks(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (taskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/swarm/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as SwarmDetail;
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (selectedTask) fetchDetail(selectedTask);
  }, [selectedTask]);

  const handleLaunch = async () => {
    if (!desc.trim() || !prompt.trim()) {
      setError('Description and prompt are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/swarm/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: desc,
          prompt,
          agents: agents.map((a) => ({
            id: a.id,
            role: a.role,
            name: a.name,
            description: a.description,
            systemPrompt: a.systemPrompt,
            allowedTools: a.allowedTools,
            maxSteps: a.maxSteps,
            priority: a.priority,
          })),
        }),
      });
      if (!res.ok) throw new Error('Launch failed');
      const data = await res.json() as { taskId: string };
      setShowLaunch(false);
      setDesc('');
      setPrompt('');
      setSelectedTask(data.taskId);
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    }
  };

  const addAgent = () => {
    setAgents((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: 'coder',
      name: `Agent ${prev.length + 1}`,
      description: '',
      maxSteps: 10,
      priority: prev.length,
    }]);
  };

  const updateAgent = (id: string, patch: Partial<SwarmAgent>) => {
    setAgents((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a));
  };

  const removeAgent = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case 'running': return <Zap className="h-4 w-4 text-amber-400 animate-pulse" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'queued': return <Clock className="h-4 w-4 text-slate-400" />;
      default: return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const filtered = tasks.filter((t) =>
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400">
            <Bug className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Swarm</h3>
            <p className="text-xs text-slate-500">Multi-agent collaboration orchestration</p>
          </div>
        </div>
        <button onClick={() => setShowLaunch(true)} className="btn-primary">
          <Rocket className="h-4 w-4" />
          Launch Swarm
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search swarm tasks..." className="input pl-9" />
      </div>

      {/* Launch Form */}
      {showLaunch && (
        <div className="card space-y-4">
          <h4 className="text-sm font-medium text-white">Launch Swarm Task</h4>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Build a React todo app" className="input" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Prompt</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="Detailed task description..." className="input resize-none" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400">Agents</label>
              <button onClick={addAgent} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add agent
              </button>
            </div>
            <div className="space-y-2">
              {agents.map((a) => (
                <div key={a.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-800/40">
                  <div className="col-span-3">
                    <input value={a.name} onChange={(e) => updateAgent(a.id, { name: e.target.value })} className="input text-xs py-1.5" />
                  </div>
                  <div className="col-span-3">
                    <select value={a.role} onChange={(e) => updateAgent(a.id, { role: e.target.value })} className="input text-xs py-1.5">
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <input value={a.description} onChange={(e) => updateAgent(a.id, { description: e.target.value })} placeholder="Role description" className="input text-xs py-1.5" />
                  </div>
                  <div className="col-span-1">
                    <input type="number" value={a.maxSteps} onChange={(e) => updateAgent(a.id, { maxSteps: Number(e.target.value) })} min={1} max={50} className="input text-xs py-1.5 text-center" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeAgent(a.id)} className="text-slate-500 hover:text-red-400">
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleLaunch} className="btn-primary">
              <Rocket className="h-4 w-4" />
              Launch
            </button>
            <button onClick={() => setShowLaunch(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Task List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Bug className="h-10 w-10 mb-2 text-slate-600" />
              <p className="text-sm">No swarm tasks yet</p>
            </div>
          ) : (
            filtered.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTask(t.id)}
                className={`card p-4 cursor-pointer hover:bg-slate-800/40 transition-colors ${selectedTask === t.id ? 'ring-1 ring-indigo-500/40' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {statusIcon(t.status)}
                    <span className="text-sm font-medium text-slate-200">{t.description}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t.agentsCount} agents</span>
                  <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {t.completedSubTasks}/{t.subTasksCount} done</span>
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="card space-y-4">
          {selectedTask && detail ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
                <div>
                  <h4 className="text-sm font-medium text-white">{detail.description}</h4>
                  <p className="text-[10px] text-slate-500">{detail.id.slice(0, 8)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                  detail.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  detail.status === 'running' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  detail.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  'bg-slate-500/10 text-slate-400 border-slate-500/20'
                }`}>
                  {detail.status}
                </span>
              </div>

              <p className="text-xs text-slate-400">{detail.originalPrompt}</p>

              {/* Agents */}
              <div>
                <label className="text-xs text-slate-400">Agents</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detail.agents.map((a) => (
                    <span key={a.id} className={`px-2 py-0.5 rounded text-[10px] font-medium border ${ROLE_COLORS[a.role] ?? 'bg-slate-700 text-slate-400'}`}>
                      {a.name} ({a.role})
                    </span>
                  ))}
                </div>
              </div>

              {/* Subtasks */}
              <div>
                <label className="text-xs text-slate-400">Subtasks</label>
                <div className="space-y-1.5 mt-1">
                  {detail.subTasks.map((st) => (
                    <div key={st.id} className="p-2 rounded-lg bg-slate-800/40 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${ROLE_COLORS[st.agentRole] ?? 'bg-slate-700 text-slate-400'}`}>{st.agentRole}</span>
                        <span className={`text-[10px] ${st.status === 'completed' ? 'text-emerald-400' : st.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>{st.status}</span>
                      </div>
                      <p className="text-slate-400 line-clamp-2">{st.prompt}</p>
                      {st.result && <p className="text-slate-500 mt-1 line-clamp-2">{st.result}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {detail.finalAnswer && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <label className="text-xs text-emerald-400 mb-1 block">Final Answer</label>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap">{detail.finalAnswer}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Bug className="h-8 w-8 mb-2 text-slate-600" />
              <p className="text-sm">Select a task to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
