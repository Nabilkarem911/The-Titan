import { useState } from 'react';
import { Workflow, Plus, Play, Save, Trash2 } from 'lucide-react';

interface WNode {
  id: string;
  type: 'agent' | 'tool' | 'condition';
  label: string;
  x: number;
  y: number;
}

interface WEdge {
  from: string;
  to: string;
}

const NODE_COLORS = {
  agent: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  tool: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  condition: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
};

export default function WorkflowDesigner() {
  const [nodes, setNodes] = useState<WNode[]>([]);
  const [edges, setEdges] = useState<WEdge[]>([]);
  const [name, setName] = useState('New Workflow');
  const [selected, setSelected] = useState<string | null>(null);

  const addNode = (type: WNode['type']) => {
    const id = `node_${Date.now()}`;
    setNodes([...nodes, {
      id, type,
      label: `${type} ${nodes.length + 1}`,
      x: 100 + nodes.length * 200,
      y: 100 + (nodes.length % 3) * 120,
    }]);
  };

  const removeNode = (id: string) => {
    setNodes(nodes.filter((n) => n.id !== id));
    setEdges(edges.filter((e) => e.from !== id && e.to !== id));
    if (selected === id) setSelected(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400">
            <Workflow className="h-5 w-5" />
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-semibold text-white bg-transparent border-b border-transparent hover:border-slate-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => addNode('agent')} className="btn-primary text-xs">
            <Plus className="h-3 w-3" /> Agent
          </button>
          <button onClick={() => addNode('tool')} className="btn-secondary text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
            <Plus className="h-3 w-3" /> Tool
          </button>
          <button onClick={() => addNode('condition')} className="btn-secondary text-xs bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
            <Plus className="h-3 w-3" /> Condition
          </button>
          <button className="btn-secondary text-xs"><Save className="h-3 w-3" /> Save</button>
          <button className="btn-primary text-xs"><Play className="h-3 w-3" /> Run</button>
        </div>
      </div>

      <div className="card min-h-[500px] relative overflow-hidden p-0">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-[500px]">
            <div className="text-center">
              <Workflow className="h-16 w-16 mx-auto mb-4 text-slate-700" />
              <p className="text-sm text-slate-400">Add nodes to start building your workflow</p>
              <p className="text-xs text-slate-600 mt-1">Click "Agent", "Tool", or "Condition" above</p>
            </div>
          </div>
        ) : (
          nodes.map((node) => (
            <div
              key={node.id}
              onClick={() => setSelected(node.id)}
              className={`absolute px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                selected === node.id ? 'ring-2 ring-indigo-500/50 shadow-lg' : ''
              } ${NODE_COLORS[node.type]}`}
              style={{ left: node.x, top: node.y }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase opacity-60">{node.type}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                  className="ml-2 opacity-50 hover:opacity-100 text-red-400"
                  aria-label={`Remove ${node.label}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="text-sm font-medium text-white mt-1">{node.label}</div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div className="card">
          <h4 className="text-sm font-medium text-white mb-2">Node Properties</h4>
          <p className="text-sm text-slate-400">Selected: <span className="font-mono text-xs">{selected}</span></p>
        </div>
      )}
    </div>
  );
}
