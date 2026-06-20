import { useState } from 'react';
import { Wrench, Code2, Save, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

interface SkillTool {
  name: string;
  description: string;
  schema: Record<string, { type: string; description?: string }>;
  requiredParams: string[];
}

const DEFAULT_CODE = `module.exports = {
  // Define your tool functions here
  // Each function receives params and returns a result
  my_tool: async function(params) {
    const { input } = params;
    return { result: "Processed: " + input };
  }
};`;

export default function SkillBuilder() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Custom');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [tools, setTools] = useState<SkillTool[]>([
    { name: 'my_tool', description: 'Describe what this tool does', schema: { input: { type: 'string', description: 'Input parameter' } }, requiredParams: ['input'] },
  ]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const addTool = () => {
    setTools([...tools, { name: `tool_${Date.now()}`, description: '', schema: {}, requiredParams: [] }]);
  };

  const removeTool = (index: number) => {
    setTools(tools.filter((_, i) => i !== index));
  };

  const updateTool = (index: number, field: keyof SkillTool, value: unknown) => {
    setTools(tools.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Skill name is required');
      return;
    }
    if (!code.trim()) {
      toast.error('Code is required');
      return;
    }

    setSaving(true);
    try {
      // Compute a simple checksum
      const checksum = btoa(code.slice(0, 100)).slice(0, 32);
      await api.post('/plugins', {
        name: name.trim(),
        description: description.trim() || undefined,
        source: 'local',
        tags: [category.toLowerCase(), 'custom'],
        capabilities: tools.map(t => t.name),
        version: '0.1.0',
        manifest: { tools, code },
        checksum,
      });
      toast.success('Skill saved! Enable it from the Marketplace.');
      setName('');
      setDescription('');
      setCode(DEFAULT_CODE);
    } catch (err) {
      toast.error('Save failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Try to evaluate the code and check if it exports the tools
      const fn = new Function(code + '\nreturn module.exports;');
      const exported = fn();
      const toolNames = Object.keys(exported || {});
      if (toolNames.length === 0) {
        setTestResult('No tools exported. Make sure to use module.exports = { ... }');
        toast.warning('No tools found in exports');
      } else {
        setTestResult(`Found ${toolNames.length} tool(s): ${toolNames.join(', ')}`);
        toast.success(`Code valid — ${toolNames.length} tools found`);
      }
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : 'Invalid code'}`);
      toast.error('Code has syntax errors');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-h1 text-text-primary">Custom Skill Builder</h1>
        <p className="text-small text-text-secondary mt-1">Write custom tools in JavaScript and register them as agent skills</p>
      </div>

      {/* Metadata */}
      <div className="card p-5 space-y-3">
        <h2 className="text-h3 text-text-primary flex items-center gap-2">
          <Wrench className="w-4 h-4 text-accent-primary" />
          Skill Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-small text-text-secondary block mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-skill" className="input" />
          </div>
          <div>
            <label className="text-small text-text-secondary block mb-1">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Custom" className="input" />
          </div>
        </div>
        <div>
          <label className="text-small text-text-secondary block mb-1">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this skill do?" className="input" />
        </div>
      </div>

      {/* Tools */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 text-text-primary flex items-center gap-2">
            <Code2 className="w-4 h-4 text-accent-secondary" />
            Tools ({tools.length})
          </h2>
          <button onClick={addTool} className="btn-secondary text-caption py-1 px-2">
            <Plus className="w-3 h-3 inline mr-1" />Add Tool
          </button>
        </div>
        {tools.map((tool, i) => (
          <div key={i} className="border border-border-subtle rounded-btn p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={tool.name}
                onChange={(e) => updateTool(i, 'name', e.target.value)}
                placeholder="tool_name"
                className="input flex-1 font-mono"
              />
              <button onClick={() => removeTool(i)} className="btn-icon hover:text-error shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input
              value={tool.description}
              onChange={(e) => updateTool(i, 'description', e.target.value)}
              placeholder="Tool description"
              className="input"
            />
          </div>
        ))}
      </div>

      {/* Code editor */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 text-text-primary flex items-center gap-2">
            <Code2 className="w-4 h-4 text-accent-tertiary" />
            JavaScript Code
          </h2>
          <button onClick={handleTest} disabled={testing} className="btn-secondary text-caption py-1 px-2">
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 inline mr-1" />}
            Test
          </button>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={16}
          className="input font-mono text-sm resize-y"
          spellCheck={false}
        />
        {testResult && (
          <div className={cn(
            'p-3 rounded-btn text-sm font-mono',
            testResult.startsWith('Error') ? 'bg-error/10 text-error' : 'bg-success/10 text-success',
          )}>
            {testResult}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Skill
        </button>
      </div>
    </div>
  );
}
