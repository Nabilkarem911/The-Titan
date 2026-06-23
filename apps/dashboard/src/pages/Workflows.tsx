import { useState, useEffect, useCallback } from 'react';
import { Workflow, Plus, Play, Trash2, Edit3, Loader2, ArrowRight, Bot, Wrench, GitBranch, Circle, Save, X } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { PageHeader } from '../components/PageHeader';

interface WFNode {
  id: string;
  type: 'agent' | 'tool' | 'condition' | 'input' | 'output';
  label: string;
  config: Record<string, unknown>;
}

interface WFEdge {
  from: string;
  to: string;
  label?: string;
}

interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  nodes: number;
  edges: number;
  entryNode: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowDetail {
  id: string;
  name: string;
  description: string;
  nodes: WFNode[];
  edges: WFEdge[];
  entryNode: string;
  createdAt: string;
  updatedAt: string;
}

const NODE_ICONS: Record<string, typeof Bot> = {
  agent: Bot,
  tool: Wrench,
  condition: GitBranch,
  input: Circle,
  output: Circle,
};

const NODE_COLORS: Record<string, string> = {
  agent: 'bg-accent-secondary/10 text-accent-secondary border-accent-secondary/30',
  tool: 'bg-accent-primary/10 text-accent-primary border-accent-primary/30',
  condition: 'bg-warning/10 text-warning border-warning/30',
  input: 'bg-accent-tertiary/10 text-accent-tertiary border-accent-tertiary/30',
  output: 'bg-accent-tertiary/10 text-accent-tertiary border-accent-tertiary/30',
};

export default function Workflows() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkflowDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNodes, setEditNodes] = useState<WFNode[]>([]);
  const [editEdges, setEditEdges] = useState<WFEdge[]>([]);
  const [editEntry, setEditEntry] = useState('');
  const [executing, setExecuting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: WorkflowSummary[]; total: number }>('/workflows');
      setWorkflows(res.items);
    } catch {
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelect = async (id: string) => {
    try {
      const res = await api.get<WorkflowDetail>(`/workflows/${id}`);
      setSelected(res);
      setEditName(res.name);
      setEditDesc(res.description);
      setEditNodes(res.nodes);
      setEditEdges(res.edges);
      setEditEntry(res.entryNode);
      setEditing(false);
    } catch {
      toast.error('Failed to load workflow');
    }
  };

  const handleCreate = async () => {
    const nodeId = `node-${Date.now()}`;
    const newWf = {
      name: 'New Workflow',
      description: '',
      nodes: [{ id: nodeId, type: 'input' as const, label: 'Start', config: {} }],
      edges: [],
      entryNode: nodeId,
    };
    try {
      const res = await api.post<WorkflowDetail>('/workflows', newWf);
      toast.success('Workflow created');
      load();
      handleSelect(res.id);
    } catch {
      toast.error('Create failed');
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      await api.put(`/workflows/${selected.id}`, {
        name: editName,
        description: editDesc,
        nodes: editNodes,
        edges: editEdges,
        entryNode: editEntry,
      });
      toast.success('Workflow saved');
      setEditing(false);
      load();
      handleSelect(selected.id);
    } catch {
      toast.error('Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    try {
      await api.delete(`/workflows/${id}`);
      toast.success('Workflow deleted');
      if (selected?.id === id) setSelected(null);
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleExecute = async () => {
    if (!selected) return;
    setExecuting(true);
    try {
      const res = await api.post<{ runId: string; status: string; results: Array<{ nodeId: string; status: string; output: unknown }> }>(`/workflows/${selected.id}/execute`, {});
      toast.success(`Workflow ${res.status}`, { description: `${res.results?.length || 0} nodes executed` });
    } catch {
      toast.error('Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const addNode = (type: WFNode['type']) => {
    const id = `node-${Date.now()}`;
    const labels: Record<string, string> = { agent: 'Agent', tool: 'Tool', condition: 'Condition', input: 'Input', output: 'Output' };
    setEditNodes([...editNodes, { id, type, label: labels[type], config: {} }]);
  };

  const removeNode = (id: string) => {
    setEditNodes(editNodes.filter(n => n.id !== id));
    setEditEdges(editEdges.filter(e => e.from !== id && e.to !== id));
    if (editEntry === id && editNodes.length > 0) {
      setEditEntry(editNodes[0].id);
    }
  };

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    if (editEdges.some(e => e.from === from && e.to === to)) return;
    setEditEdges([...editEdges, { from, to }]);
  };

  const removeEdge = (from: string, to: string) => {
    setEditEdges(editEdges.filter(e => !(e.from === from && e.to === to)));
  };

  const displayNodes = editing ? editNodes : (selected?.nodes ?? []);
  const displayEdges = editing ? editEdges : (selected?.edges ?? []);
  const displayEntry = editing ? editEntry : selected?.entryNode;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="workflows"
        icon={Workflow}
        title="Workflows"
        subtitle="Build automated agent pipelines"
        description="Workflows are visual pipelines that chain agents, tools, and conditions together. Drag nodes onto the canvas, connect them with edges, and configure each node. Workflows can be triggered manually, by webhooks, or on a schedule. Perfect for multi-step processes like content generation, data processing, or CI/CD automation."
        tips={[
          'Click New Workflow to start building a visual pipeline',
          'Each node can be an agent, a tool, a condition, or input/output',
          'Connect nodes with edges to define the execution flow',
          'From chat: titan chat "run my content-generation workflow"',
        ]}
        actions={
          <button onClick={handleCreate} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Workflow list */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary">All Workflows</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Workflow className="w-10 h-10 text-text-muted mb-3" />
              <p className="text-small text-text-secondary">No workflows yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {workflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => handleSelect(wf.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-elevated transition-colors',
                    selected?.id === wf.id && 'bg-accent-primary/10',
                  )}
                >
                  <p className="text-sm text-text-primary font-medium">{wf.name}</p>
                  <p className="text-caption text-text-muted mt-0.5">{wf.nodes} nodes · {wf.edges} edges</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Workflow detail / editor */}
        <div className="lg:col-span-2 card overflow-hidden">
          {selected ? (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                <div className="flex-1 min-w-0">
                  {editing ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input" placeholder="Workflow name" />
                  ) : (
                    <h2 className="text-h3 text-text-primary truncate">{selected.name}</h2>
                  )}
                  <p className="text-caption text-text-muted mt-0.5">
                    {editing ? (
                      <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="input mt-1" placeholder="Description" />
                    ) : (
                      selected.description || 'No description'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {editing ? (
                    <>
                      <button onClick={handleSave} className="btn-primary">
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button onClick={() => setEditing(false)} className="btn-icon"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditing(true)} className="btn-secondary">
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                      <button onClick={handleExecute} disabled={executing} className="btn-primary">
                        {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Run
                      </button>
                      <button onClick={() => handleDelete(selected.id)} className="btn-icon hover:text-error">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Nodes */}
              <div className="p-5 space-y-4">
                {editing && (
                  <div className="flex items-center gap-2">
                    <span className="text-small text-text-secondary">Add node:</span>
                    {(['input', 'agent', 'tool', 'condition', 'output'] as const).map(t => (
                      <button key={t} onClick={() => addNode(t)} className="btn-secondary text-caption py-1 px-2">
                        + {t}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {displayNodes.map((node) => {
                    const Icon = NODE_ICONS[node.type] || Circle;
                    const isEntry = displayEntry === node.id;
                    return (
                      <div key={node.id} className={cn(
                        'flex items-center gap-3 p-3 rounded-btn border',
                        NODE_COLORS[node.type] || 'border-border-subtle',
                      )}>
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{node.label}</span>
                          {isEntry && <span className="badge bg-accent-primary/10 text-accent-primary text-caption ml-2">entry</span>}
                        </div>
                        <span className="text-caption text-text-muted">{node.type}</span>
                        {editing && (
                          <button onClick={() => removeNode(node.id)} className="text-text-muted hover:text-error">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Edges */}
                {displayEdges.length > 0 && (
                  <div>
                    <h3 className="text-small text-text-secondary mb-2">Connections</h3>
                    <div className="space-y-1">
                      {displayEdges.map((edge, i) => (
                        <div key={i} className="flex items-center gap-2 text-caption text-text-secondary">
                          <span className="badge bg-elevated">{edge.from}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="badge bg-elevated">{edge.to}</span>
                          {edge.label && <span className="text-text-muted">({edge.label})</span>}
                          {editing && (
                            <button onClick={() => removeEdge(edge.from, edge.to)} className="text-text-muted hover:text-error ml-1">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add edge in edit mode */}
                {editing && editNodes.length >= 2 && (
                  <div className="flex items-center gap-2 text-caption">
                    <select
                      onChange={(e) => {
                        const from = e.target.value;
                        const toSelect = editNodes.find(n => n.id !== from);
                        if (toSelect) addEdge(from, toSelect.id);
                        e.target.value = '';
                      }}
                      className="input py-1 text-caption max-w-[150px]"
                      defaultValue=""
                    >
                      <option value="" disabled>Add connection...</option>
                      {editNodes.map(n => <option key={n.id} value={n.id}>From: {n.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Workflow className="w-12 h-12 text-text-muted mb-3" />
              <h3 className="text-h3 text-text-primary mb-1">Select a workflow</h3>
              <p className="text-small text-text-secondary">Choose from the list or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
