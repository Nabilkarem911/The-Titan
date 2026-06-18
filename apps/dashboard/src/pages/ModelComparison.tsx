import { useState } from 'react';
import { GitCompare, Zap, DollarSign, BarChart3 } from 'lucide-react';

const MODELS = [
  { name: 'GPT-4o', cost: '$2.50/M in + $10/M out', speed: 'Medium', quality: 5, context: '128K' },
  { name: 'GPT-4o Mini', cost: '$0.15/M in + $0.60/M out', speed: 'Fast', quality: 4, context: '128K' },
  { name: 'Claude Sonnet 4.6', cost: '$3/M in + $15/M out', speed: 'Medium', quality: 5, context: '200K' },
  { name: 'Claude Haiku 4.5', cost: '$0.80/M in + $4/M out', speed: 'Fast', quality: 4, context: '200K' },
  { name: 'Claude Opus 4.8', cost: '$15/M in + $75/M out', speed: 'Slow', quality: 5, context: '200K' },
  { name: 'Groq Llama 3', cost: 'Free tier', speed: 'Ultra Fast', quality: 3, context: '128K' },
  { name: 'Local (Ollama)', cost: 'Free', speed: 'Depends', quality: 3, context: 'Varies' },
];

export default function ModelComparison() {
  const [selected, setSelected] = useState<string | null>(null);

  const speedColor = (speed: string) => {
    if (speed.includes('Fast')) return 'badge-success';
    if (speed === 'Slow') return 'badge-error';
    return 'badge-warning';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-500/20 text-violet-400">
          <GitCompare className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Model Comparison</h3>
          <p className="text-xs text-slate-500">Compare LLM providers, pricing, and capabilities</p>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3 font-medium">Model</th>
              <th className="px-6 py-3 font-medium"><DollarSign className="h-3 w-3 inline mr-1" />Cost</th>
              <th className="px-6 py-3 font-medium"><Zap className="h-3 w-3 inline mr-1" />Speed</th>
              <th className="px-6 py-3 font-medium"><BarChart3 className="h-3 w-3 inline mr-1" />Quality</th>
              <th className="px-6 py-3 font-medium">Context</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {MODELS.map((m) => (
              <tr
                key={m.name}
                onClick={() => setSelected(m.name)}
                className={`cursor-pointer transition-colors ${selected === m.name ? 'bg-indigo-500/5' : 'hover:bg-slate-800/30'}`}
              >
                <td className="px-6 py-3 font-medium text-white">{m.name}</td>
                <td className="px-6 py-3 text-slate-400">{m.cost}</td>
                <td className="px-6 py-3"><span className={speedColor(m.speed)}>{m.speed}</span></td>
                <td className="px-6 py-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < m.quality ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                    ))}
                  </div>
                </td>
                <td className="px-6 py-3 text-slate-400">{m.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h4 className="text-sm font-medium text-white mb-2">Recommendation</h4>
        <p className="text-sm text-slate-400">
          Titan's <strong className="text-white">Multi-Model Router</strong> automatically selects the best model per task.
          Configure strategy in Settings: cheapest, fastest, best quality, or round-robin with fallback.
        </p>
      </div>
    </div>
  );
}
