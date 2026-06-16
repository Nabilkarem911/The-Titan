import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, User, Search, AlertCircle, ChevronDown } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
}

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? '/api/v1';
const getToken = () => localStorage.getItem('titan_access_token') ?? '';

export default function TeamsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [wsDropdown, setWsDropdown] = useState(false);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch(`${API_BASE}/workspaces`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: Workspace[] };
      const list = data.items ?? [];
      setWorkspaces(list);
      if (list.length > 0 && !selectedWs) setSelectedWs(list[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const fetchMembers = async (wsId: string) => {
    try {
      const res = await fetch(`${API_BASE}/workspaces/${wsId}/members`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: Member[] };
      setMembers(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWs) fetchMembers(selectedWs);
  }, [selectedWs]);

  const handleAdd = async () => {
    if (!addUserId.trim() || !selectedWs) return;
    try {
      const res = await fetch(`${API_BASE}/workspaces/${selectedWs}/members`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: addUserId, role: addRole }),
      });
      if (!res.ok) throw new Error('Add failed');
      setShowAdd(false);
      setAddUserId('');
      setAddRole('member');
      await fetchMembers(selectedWs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    }
  };

  const handleRemove = async (userId: string) => {
    if (!selectedWs || !confirm('Remove this member?')) return;
    try {
      const res = await fetch(`${API_BASE}/workspaces/${selectedWs}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Remove failed');
      await fetchMembers(selectedWs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  const currentWs = workspaces.find((w) => w.id === selectedWs);
  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Shield className="h-3.5 w-3.5 text-amber-400" />;
      case 'admin': return <Shield className="h-3.5 w-3.5 text-indigo-400" />;
      default: return <User className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'admin': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'member': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 text-blue-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Teams</h3>
            <p className="text-xs text-slate-500">Manage workspace members and roles</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Add Member
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Workspace selector */}
      <div className="relative">
        <button
          onClick={() => setWsDropdown(!wsDropdown)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
        >
          {currentWs?.name ?? 'Select Workspace'}
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
        {wsDropdown && (
          <div className="absolute z-10 mt-1 w-64 bg-slate-900 border border-slate-700/50 rounded-lg shadow-xl overflow-hidden">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => { setSelectedWs(w.id); setWsDropdown(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-800/60 transition-colors ${selectedWs === w.id ? 'text-indigo-400 bg-indigo-500/5' : 'text-slate-300'}`}
              >
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-slate-500">{w.slug}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Member */}
      {showAdd && (
        <div className="card space-y-3">
          <h4 className="text-sm font-medium text-white">Add Member</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">User ID</label>
              <input value={addUserId} onChange={(e) => setAddUserId(e.target.value)} placeholder="User UUID" className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Role</label>
              <select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="input">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary">
              <Plus className="h-4 w-4" />
              Add
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-800/50 flex items-center gap-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-800/50">
              <th className="px-4 py-2.5 font-medium">Member</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500 text-xs">
                  {members.length === 0 ? 'No members found' : 'No matching members'}
                </td>
              </tr>
            ) : (
              filteredMembers.map((m) => (
                <tr key={m.id} className="border-b border-slate-800/20 hover:bg-slate-800/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {roleIcon(m.role)}
                      <div>
                        <div className="text-slate-200 text-xs font-medium">{m.name}</div>
                        <div className="text-slate-500 text-[11px]">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${roleBadge(m.role)}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(m.userId)}
                      className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
