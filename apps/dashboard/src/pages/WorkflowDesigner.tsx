import { useState } from 'react';
import { GitBranch, Plus, Play, Save, Trash2 } from 'lucide-react';

interface WNode { id: string; type: 'agent' | 'tool' | 'condition'; label: string; x: number; y: number }
interface WEdge { from: string; to: string }

export default function WorkflowDesigner() {
  const [nodes, setNodes] = useState<WNode[]>([]);
  const [edges, setEdges] = useState<WEdge[]>([]);
  const [name, setName] = useState('New Workflow');
  const [selected, setSelected] = useState<string | null>(null);

  const addNode = (type: WNode['type']) => {
    const id = `node_${Date.now()}`;
    setNodes([...nodes, { id, type, label: `${type} ${nodes.length + 1}`, x: 100 + nodes.length * 200, y: 100 + (nodes.length % 3) * 120 }]);
  };

  const removeNode = (id: string) => {
    setNodes(nodes.filter((n) => n.id !== id));
    setEdges(edges.filter((e) => e.from !== id && e.to !== id));
    if (selected === id) setSelected(null);
  };

  return (
    <div className="p-6 space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-indigo-500" />
          <input value={name} onChange={(e) => setName(e.target.value)} className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-zinc-600 focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => addNode('agent')} className="flex items-center gap-1 px-3 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> Agent</button>
          <button onClick={() => addNode('tool')} className="flex items-center gap-1 px-3 py-2 bg-green-600 rounded-lg text-sm hover:bg-green-700"><Plus className="w-4 h-4" /> Tool</button>
          <button onClick={() => addNode('condition')} className="flex items-center gap-1 px-3 py-2 bg-yellow-600 rounded-lg text-sm hover:bg-yellow-700"><Plus className="w-4 h-4" /> Condition</button>
          <button className="flex items-center gap-1 px-3 py-2 bg-zinc-700 rounded-lg text-sm hover:bg-zinc-600"><Save className="w-4 h-4" /> Save</button>
          <button className="flex items-center gap-1 px-3 py-2 bg-purple-600 rounded-lg text-sm hover:bg-purple-700"><Play className="w-4 h-4" /> Run</button>
        </div>
      </div>
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 min-h-[500px] relative overflow-hidden">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-[500px] text-zinc-500">
            <div className="text-center"><GitBranch className="w-16 h-16 mx-auto mb-4 opacity-20" /><p>Add nodes to start building your workflow</p><p className="text-xs mt-1">Click "Agent", "Tool", or "Condition" above</p></div>
          </div>
        ) : (
          nodes.map((node) => (
            <div key={node.id} onClick={() => setSelected(node.id)} className={`absolute px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${selected === node.id ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-zinc-700'} ${node.type === 'agent' ? 'bg-blue-950' : node.type === 'tool' ? 'bg-green-950' : 'bg-yellow-950'}`} style={{ left: node.x, top: node.y }}>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase opacity-60">{node.type}</span>
                <button onClick={(e) => { e.stopPropagation(); removeNode(node.id); }} className="ml-2 opacity-50 hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
              </div>
              <div className="font-medium text-sm mt-1">{node.label}</div>
            </div>
          ))
        )}
      </div>
      {selected && <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800"><h3 className="font-semibold mb-2">Node Properties</h3><p className="text-sm text-zinc-400">Selected: {selected}</p></div>}
    </div>
  );
}
