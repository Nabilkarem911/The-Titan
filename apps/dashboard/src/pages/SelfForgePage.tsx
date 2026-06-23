import { useState, useEffect, useCallback } from 'react';
import { Globe, Loader2, RefreshCw, Wrench, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface ForgedTool {
  name: string;
  description: string;
  createdAt: string;
  uses: number;
}

interface SkillMd {
  name: string;
  description: string;
  capabilities: string[];
  scripts: Array<{ name: string; command: string }>;
}

export default function SelfForgePage() {
  const [tools, setTools] = useState<ForgedTool[]>([]);
  const [skills, setSkills] = useState<SkillMd[]>([]);
  const [loading, setLoading] = useState(true);
  const [capability, setCapability] = useState('');
  const [forging, setForging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [toolsRes, skillsRes] = await Promise.all([
        api.get<{ tools: ForgedTool[] }>('/forge/tools').catch(() => ({ tools: [] })),
        api.get<{ skills: SkillMd[] }>('/skills-md').catch(() => ({ skills: [] })),
      ]);
      setTools(toolsRes.tools ?? []);
      setSkills(skillsRes.skills ?? []);
    } catch {
      toast.error('Failed to load self-forge data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleForge = async () => {
    if (!capability.trim()) return;
    setForging(true);
    try {
      await api.post('/forge/tool', { capability });
      toast.success('Tool forged successfully');
      setCapability('');
      await load();
    } catch {
      toast.error('Failed to forge tool');
    } finally {
      setForging(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <Wrench className="w-6 h-6 text-accent-primary" />
            Self-Forge & Skills
          </h1>
          <p className="text-small text-text-secondary mt-1">Tool forging, skill synthesis, and Skill.md registry</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-4">Forge New Tool</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={capability}
            onChange={(e) => setCapability(e.target.value)}
            placeholder="Describe what the tool should do..."
            className="input flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleForge()}
          />
          <button onClick={handleForge} disabled={forging || !capability.trim()} className="btn-primary flex items-center gap-2">
            {forging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Forge
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary">Forged Tools ({tools.length})</h2>
          </div>
          {tools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wrench className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No forged tools yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {tools.map((t) => (
                <div key={t.name} className="px-5 py-3">
                  <p className="text-sm font-medium text-text-primary">{t.name}</p>
                  <p className="text-caption text-text-secondary">{t.description}</p>
                  <p className="text-caption text-text-muted mt-0.5">{t.uses} uses</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary">Skill.md Registry ({skills.length})</h2>
          </div>
          {skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Globe className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-small text-text-secondary">No skills registered</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle max-h-96 overflow-y-auto">
              {skills.map((s) => (
                <div key={s.name} className="px-5 py-3">
                  <p className="text-sm font-medium text-text-primary">{s.name}</p>
                  <p className="text-caption text-text-secondary">{s.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.capabilities.map((c) => (
                      <span key={c} className="badge bg-accent-primary/10 text-accent-primary text-caption">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
