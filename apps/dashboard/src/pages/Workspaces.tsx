import React, { useState } from 'react';
import { Building2, Plus, Users, Trash2, Edit3, Save, X, UserPlus } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames, formatRelativeTime } from '../utils/format';
import type { Workspace, WorkspaceMember } from '../api/client';

export default function Workspaces() {
  const [activeTab, setActiveTab] = useState<'workspaces' | 'teams'>('workspaces');
  const [editing, setEditing] = useState<Partial<Workspace> | null>(null);
  const [selectedWs, setSelectedWs] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('member');
  const { data: workspaces, error, isLoading, refetch } = useApi<Workspace[]>(() => api.getWorkspaces(), []);

  const save = async () => {
    if (!editing) return;
    if (editing.id) await api.updateWorkspace(editing.id, editing);
    else await api.createWorkspace(editing);
    setEditing(null); refetch();
  };

  const loadMembers = async (wsId: string) => {
    setSelectedWs(wsId); setActiveTab('teams');
    setMembers(await api.getWorkspaceMembers(wsId));
  };

  const addMember = async () => {
    if (!selectedWs || !addEmail.trim()) return;
    await api.addWorkspaceMember(selectedWs, { email: addEmail.trim(), role: addRole });
    setAddEmail(''); setMembers(await api.getWorkspaceMembers(selectedWs));
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">{workspaces?.length ?? 0} workspaces</p>
        <button onClick={() => setEditing({ name: '', description: '' })} className="btn btn-primary"><Plus className="w-4 h-4" /> New Workspace</button>
      </div>
      <div className="tabs">
        <button className={classNames('tab', activeTab === 'workspaces' && 'active')} onClick={() => setActiveTab('workspaces')}><Building2 className="w-4 h-4 inline-block me-1.5" /> Workspaces</button>
        <button className={classNames('tab', activeTab === 'teams' && 'active')} onClick={() => setActiveTab('teams')} disabled={!selectedWs}><Users className="w-4 h-4 inline-block me-1.5" /> Teams</button>
      </div>

      {activeTab === 'workspaces' && (!workspaces || workspaces.length === 0 ? (
        <EmptyState icon={<Building2 className="w-7 h-7 text-text-muted" />} title="No workspaces" message="Create workspaces to organize your team" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <div key={ws.id} className="card p-5 hover:border-border-light transition-all">
              <h3 className="font-heading font-semibold text-text-primary mb-1">{ws.name}</h3>
              {ws.description && <p className="text-sm text-text-secondary mb-3">{ws.description}</p>}
              <div className="flex items-center gap-3 text-xs text-text-muted mb-4"><span>{ws.member_count} members</span><span>{ws.agent_count} agents</span></div>
              <div className="flex gap-2">
                <button onClick={() => loadMembers(ws.id)} className="btn btn-secondary btn-sm flex-1"><Users className="w-4 h-4" /> Team</button>
                <button onClick={() => setEditing({ ...ws })} className="btn btn-ghost btn-sm"><Edit3 className="w-4 h-4" /></button>
                <button onClick={async () => { await api.deleteWorkspace(ws.id); refetch(); }} className="btn btn-ghost btn-sm text-text-muted hover:text-pink"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {activeTab === 'teams' && selectedWs && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Email address" className="input flex-1" />
            <select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="input w-32"><option value="viewer">Viewer</option><option value="member">Member</option><option value="admin">Admin</option></select>
            <button onClick={addMember} disabled={!addEmail.trim()} className="btn btn-primary"><UserPlus className="w-4 h-4" /> Add</button>
          </div>
          {members.length === 0 ? (
            <EmptyState icon={<Users className="w-7 h-7 text-text-muted" />} title="No team members" message="Add members to this workspace" />
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="text-text-primary">{m.username}</td>
                      <td className="text-xs text-text-secondary">{m.email}</td>
                      <td><span className={classNames('badge', m.role === 'owner' ? 'badge-violet' : m.role === 'admin' ? 'badge-info' : 'badge-neutral')}>{m.role}</span></td>
                      <td className="text-xs">{formatRelativeTime(m.joined_at)}</td>
                      <td>{m.role !== 'owner' && <button onClick={async () => { if (selectedWs) { await api.removeWorkspaceMember(selectedWs, m.id); setMembers(await api.getWorkspaceMembers(selectedWs)); } }} className="btn btn-ghost p-1 text-text-muted hover:text-pink"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-text-primary">{editing.id ? 'Edit' : 'New'} Workspace</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm text-text-secondary mb-1.5">Name</label><input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Description</label><textarea value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="input" rows={3} /></div>
              <div className="flex gap-2"><button onClick={save} className="btn btn-primary flex-1"><Save className="w-4 h-4" /> Save</button><button onClick={() => setEditing(null)} className="btn btn-secondary">Cancel</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
