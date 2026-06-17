import { useState, useEffect } from 'react';
import {
  FileCode,
  Plus,
  Trash2,
  Edit3,
  Globe,
  Lock,
  Search,
  AlertCircle,
  X,
  Save,
  Copy,
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  systemPrompt: string | null;
  model: string | null;
  allowedTools: string[];
  forbiddenTools: string[];
  maxSteps: number;
  temperature: number | null;
  isPublic: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

import { API_BASE, getToken } from '../api/client';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<Template[]>([]);
  const [tab, setTab] = useState<'mine' | 'public'>('mine');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [editing, setEditing] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formMaxSteps, setFormMaxSteps] = useState(10);
  const [formTemp, setFormTemp] = useState<number | ''>('');
  const [formPublic, setFormPublic] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mineRes, pubRes] = await Promise.all([
        fetch(`${API_BASE}/agent-profiles`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch(`${API_BASE}/agent-profiles/public`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
      ]);
      if (!mineRes.ok || !pubRes.ok) throw new Error('Failed');
      const mineData = await mineRes.json() as { items: Template[] };
      const pubData = await pubRes.json() as { items: Template[] };
      setTemplates(mineData.items ?? []);
      setPublicTemplates(pubData.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setFormDesc('');
    setFormPrompt('');
    setFormModel('');
    setFormMaxSteps(10);
    setFormTemp('');
    setFormPublic(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim()) {
      setError('Name and slug are required');
      return;
    }
    try {
      const body = {
        name: formName,
        slug: formSlug,
        description: formDesc || undefined,
        systemPrompt: formPrompt || undefined,
        model: formModel || undefined,
        maxSteps: formMaxSteps,
        temperature: formTemp === '' ? undefined : Number(formTemp),
        isPublic: formPublic,
      };
      const url = editing ? `${API_BASE}/agent-profiles/${editing.id}` : `${API_BASE}/agent-profiles`;
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(editing ? 'Update failed' : 'Create failed');
      setShowForm(false);
      resetForm();
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      const res = await fetch(`${API_BASE}/agent-profiles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  function populateForm(t: Template, mode: 'edit' | 'clone') {
    const isEdit = mode === 'edit';
    setEditing(isEdit ? t : null);
    setFormName(isEdit ? t.name : `${t.name} (copy)`);
    setFormSlug(isEdit ? t.slug : `${t.slug}-copy`);
    setFormDesc(t.description ?? '');
    setFormPrompt(t.systemPrompt ?? '');
    setFormModel(t.model ?? '');
    setFormMaxSteps(t.maxSteps);
    setFormTemp(t.temperature ?? '');
    setFormPublic(isEdit ? t.isPublic : false);
    setShowForm(true);
  }

  const handleEdit = (t: Template) => populateForm(t, 'edit');
  const handleClone = (t: Template) => populateForm(t, 'clone');

  const source = tab === 'mine' ? templates : publicTemplates;
  const filtered = source.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20 text-amber-400">
            <FileCode className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Agent Templates</h3>
            <p className="text-xs text-slate-500">Save, share, and reuse agent configurations</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800/50 pb-1">
        <button
          onClick={() => setTab('mine')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'mine' ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          My Templates
        </button>
        <button
          onClick={() => setTab('public')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'public' ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Public Gallery
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="input pl-9" />
      </div>

      {/* Form */}
      {showForm && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">{editing ? 'Edit Template' : 'New Template'}</h4>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Name</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Slug</label>
              <input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Description</label>
            <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">System Prompt</label>
            <textarea value={formPrompt} onChange={(e) => setFormPrompt(e.target.value)} rows={4} className="input resize-none font-mono text-xs" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Model</label>
              <input value={formModel} onChange={(e) => setFormModel(e.target.value)} placeholder="gpt-4o" className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Max Steps</label>
              <input type="number" value={formMaxSteps} onChange={(e) => setFormMaxSteps(Number(e.target.value))} min={1} max={50} className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Temperature</label>
              <input type="number" step="0.1" value={formTemp} onChange={(e) => setFormTemp(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.7" className="input" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formPublic} onChange={(e) => setFormPublic(e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-indigo-500" />
            <span className="text-xs text-slate-400">Make public</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary">
              <Save className="h-4 w-4" />
              Save
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <FileCode className="h-10 w-10 mb-2 text-slate-600" />
          <p className="text-sm">No templates found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <div key={t.id} className="card p-4 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-slate-200">{t.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {t.isPublic ? <span title="Public"><Globe className="h-3 w-3 text-emerald-400" /></span> : <span title="Private"><Lock className="h-3 w-3 text-slate-500" /></span>}
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3 line-clamp-2">{t.description || 'No description'}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {t.model && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">{t.model}</span>}
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">{t.maxSteps} steps</span>
                {t.temperature !== null && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">T={t.temperature}</span>}
              </div>
              <div className="flex items-center gap-1">
                {tab === 'mine' && (
                  <>
                    <button onClick={() => handleEdit(t)} className="p-1.5 rounded text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Edit">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button onClick={() => handleClone(t)} className="p-1.5 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Clone">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
