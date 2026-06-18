import { useState } from 'react';
import { Layers, Zap, Coins, BarChart3 } from 'lucide-react';

const MODELS = [
  { name: 'GPT-4o', cost: '$2.50/M in + $10/M out', speed: 'Medium', quality: '⭐⭐⭐⭐⭐', context: '128K' },
  { name: 'GPT-4o Mini', cost: '$0.15/M in + $0.60/M out', speed: 'Fast', quality: '⭐⭐⭐⭐', context: '128K' },
  { name: 'Claude Sonnet 4.6', cost: '$3/M in + $15/M out', speed: 'Medium', quality: '⭐⭐⭐⭐⭐', context: '200K' },
  { name: 'Claude Haiku 4.5', cost: '$0.80/M in + $4/M out', speed: 'Fast', quality: '⭐⭐⭐⭐', context: '200K' },
  { name: 'Claude Opus 4.8', cost: '$15/M in + $75/M out', speed: 'Slow', quality: '⭐⭐⭐⭐⭐', context: '200K' },
  { name: 'Groq Llama 3', cost: 'Free tier', speed: 'Ultra Fast', quality: '⭐⭐⭐', context: '128K' },
  { name: 'Local (Ollama)', cost: 'Free', speed: 'Depends', quality: '⭐⭐⭐', context: 'Varies' },
];

export default function ModelComparison() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="w-6 h-6 text-violet-500" /> Model Comparison</h1>
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
            <th className="p-4">Model</th><th className="p-4"><Coins className="w-4 h-4 inline mr-1" />Cost</th><th className="p-4"><Zap className="w-4 h-4 inline mr-1" />Speed</th><th className="p-4"><BarChart3 className="w-4 h-4 inline mr-1" />Quality</th><th className="p-4">Context</th>
          </tr></thead>
          <tbody>{MODELS.map((m) => (
            <tr key={m.name} onClick={() => setSelected(m.name)} className={`border-b border-zinc-800/50 cursor-pointer hover:bg-zinc-800/30 ${selected === m.name ? 'bg-zinc-800/50' : ''}`}>
              <td className="p-4 font-medium">{m.name}</td>
              <td className="p-4 text-sm text-zinc-400">{m.cost}</td>
              <td className="p-4"><span className={`text-xs px-2 py-1 rounded ${m.speed.includes('Fast') ? 'bg-green-900 text-green-300' : m.speed === 'Slow' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>{m.speed}</span></td>
              <td className="p-4 text-sm">{m.quality}</td>
              <td className="p-4 text-sm text-zinc-400">{m.context}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-lg font-semibold mb-2">Recommendation</h2>
        <p className="text-sm text-zinc-400">Titan's <strong>Multi-Model Router</strong> automatically selects the best model per task. Configure strategy in Settings: cheapest, fastest, best quality, or round-robin with fallback.</p>
      </div>
    </div>
  );
}
