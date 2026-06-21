import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { ShieldCheck, RefreshCw, Plus, Trash2, Search } from 'lucide-react';
import { ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { toast } from 'sonner';

interface MCPGovernanceStats {
  totalPolicies: number;
  totalAuditEntries: number;
  allowedInvocations: number;
  deniedInvocations: number;
  rateLimitedRequests: number;
  concurrentRejections: number;
  oauthConfiguredServers: number;
}

interface MCPAuditEntry {
  id: string;
  serverId: string;
  toolName: string;
  permission: string;
  userId?: string;
  allowed: boolean;
  reason: string;
  timestamp: string;
}

interface MCPPolicy {
  serverId: string;
  allowedPermissions: string[];
  allowedTools: string[] | '*';
  deniedTools: string[];
  rateLimitPerMinute: number;
  requiresApproval: boolean;
  maxConcurrentInvocations: number;
  auditEnabled: boolean;
}

export default function MCPGovernance() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useApi<MCPGovernanceStats>('/mcp-governance/stats');
  const { data: policiesData, isLoading: policiesLoading, refetch: refetchPolicies } = useApi<{ policies: MCPPolicy[] }>('/mcp-governance/policies');
  const [auditFilter, setAuditFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    serverId: '',
    allowedPermissions: 'read,execute',
    allowedTools: '*',
    deniedTools: '',
    rateLimitPerMinute: '60',
    requiresApproval: false,
    maxConcurrentInvocations: '5',
    auditEnabled: true,
  });

  const { data: auditData, refetch: refetchAudit } = useApi<{ entries: MCPAuditEntry[] }>(
    auditFilter ? `/mcp-governance/audit?serverId=${encodeURIComponent(auditFilter)}` : '/mcp-governance/audit'
  );

  const handleAddPolicy = useCallback(async () => {
    if (!formData.serverId.trim()) {
      toast.error('Server ID is required');
      return;
    }
    try {
      await api.post('/mcp-governance/policies', {
        serverId: formData.serverId,
        allowedPermissions: formData.allowedPermissions.split(',').map(s => s.trim()).filter(Boolean),
        allowedTools: formData.allowedTools === '*' ? '*' : formData.allowedTools.split(',').map(s => s.trim()).filter(Boolean),
        deniedTools: formData.deniedTools.split(',').map(s => s.trim()).filter(Boolean),
        rateLimitPerMinute: parseInt(formData.rateLimitPerMinute, 10),
        requiresApproval: formData.requiresApproval,
        maxConcurrentInvocations: parseInt(formData.maxConcurrentInvocations, 10),
        auditEnabled: formData.auditEnabled,
      });
      toast.success('Policy created');
      setShowAddForm(false);
      setFormData({ serverId: '', allowedPermissions: 'read,execute', allowedTools: '*', deniedTools: '', rateLimitPerMinute: '60', requiresApproval: false, maxConcurrentInvocations: '5', auditEnabled: true });
      refetchPolicies();
      refetchStats();
    } catch (err) {
      toast.error('Failed to create policy');
    }
  }, [formData, refetchPolicies, refetchStats]);

  const handleDeletePolicy = useCallback(async (serverId: string) => {
    try {
      await api.delete(`/mcp-governance/policies/${serverId}`);
      toast.success('Policy deleted');
      refetchPolicies();
      refetchStats();
    } catch {
      toast.error('Failed to delete policy');
    }
  }, [refetchPolicies, refetchStats]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-accent-primary" />
            MCP Governance
          </h1>
          <p className="text-small text-text-secondary mt-1">Per-server policies, permissions, rate limiting & audit</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { refetchStats(); refetchPolicies(); refetchAudit(); }} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Policy
          </button>
        </div>
      </div>

      {statsError && <ErrorState message={statsError} onRetry={refetchStats} />}

      {showAddForm && (
        <div className="card p-5 space-y-4">
          <h2 className="text-h3 text-text-primary">New Governance Policy</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-small text-text-secondary">Server ID</label>
              <input className="input-field mt-1" value={formData.serverId} onChange={e => setFormData({ ...formData, serverId: e.target.value })} placeholder="mcp-server-1" />
            </div>
            <div>
              <label className="text-small text-text-secondary">Allowed Permissions (comma-separated)</label>
              <input className="input-field mt-1" value={formData.allowedPermissions} onChange={e => setFormData({ ...formData, allowedPermissions: e.target.value })} />
            </div>
            <div>
              <label className="text-small text-text-secondary">Allowed Tools (* or comma-separated)</label>
              <input className="input-field mt-1" value={formData.allowedTools} onChange={e => setFormData({ ...formData, allowedTools: e.target.value })} />
            </div>
            <div>
              <label className="text-small text-text-secondary">Denied Tools (comma-separated)</label>
              <input className="input-field mt-1" value={formData.deniedTools} onChange={e => setFormData({ ...formData, deniedTools: e.target.value })} />
            </div>
            <div>
              <label className="text-small text-text-secondary">Rate Limit (per minute)</label>
              <input type="number" className="input-field mt-1" value={formData.rateLimitPerMinute} onChange={e => setFormData({ ...formData, rateLimitPerMinute: e.target.value })} />
            </div>
            <div>
              <label className="text-small text-text-secondary">Max Concurrent</label>
              <input type="number" className="input-field mt-1" value={formData.maxConcurrentInvocations} onChange={e => setFormData({ ...formData, maxConcurrentInvocations: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-small text-text-secondary">
              <input type="checkbox" checked={formData.requiresApproval} onChange={e => setFormData({ ...formData, requiresApproval: e.target.checked })} />
              Requires Approval
            </label>
            <label className="flex items-center gap-2 text-small text-text-secondary">
              <input type="checkbox" checked={formData.auditEnabled} onChange={e => setFormData({ ...formData, auditEnabled: e.target.checked })} />
              Audit Enabled
            </label>
          </div>
          <button onClick={handleAddPolicy} className="btn-primary">Create Policy</button>
        </div>
      )}

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-h2 font-bold text-accent-primary tabular-nums">{stats.totalPolicies}</p>
            <p className="text-caption text-text-muted">Total Policies</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-success tabular-nums">{stats.allowedInvocations}</p>
            <p className="text-caption text-text-muted">Allowed</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-error tabular-nums">{stats.deniedInvocations}</p>
            <p className="text-caption text-text-muted">Denied</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-warning tabular-nums">{stats.rateLimitedRequests}</p>
            <p className="text-caption text-text-muted">Rate Limited</p>
          </div>
        </div>
      ) : null}

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-3">Policies</h2>
        {policiesLoading ? (
          <SkeletonCard />
        ) : policiesData?.policies.length ? (
          <div className="space-y-3">
            {policiesData.policies.map((p) => (
              <div key={p.serverId} className="flex items-center justify-between p-3 rounded-btn bg-elevated">
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium text-text-primary">{p.serverId}</p>
                  <p className="text-caption text-text-muted">
                    {Array.isArray(p.allowedTools) ? p.allowedTools.join(', ') : p.allowedTools} • {p.allowedPermissions.join(', ')} • {p.rateLimitPerMinute}/min • max {p.maxConcurrentInvocations} concurrent
                  </p>
                </div>
                <button onClick={() => handleDeletePolicy(p.serverId)} className="btn-ghost text-error hover:text-error">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-small text-text-muted">No policies configured</p>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h3 text-text-primary">Audit Log</h2>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-text-muted" />
            <input
              className="input-field !py-1 !text-small w-48"
              placeholder="Filter by server ID..."
              value={auditFilter}
              onChange={e => setAuditFilter(e.target.value)}
            />
          </div>
        </div>
        {auditData?.entries.length ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditData.entries.slice().reverse().map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-2 rounded-btn bg-elevated text-small">
                <span className={`px-2 py-0.5 rounded text-caption font-medium ${e.allowed ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                  {e.allowed ? 'ALLOW' : 'DENY'}
                </span>
                <span className="text-text-primary font-mono">{e.serverId}/{e.toolName}</span>
                <span className="text-text-muted flex-1 truncate">{e.reason}</span>
                <span className="text-caption text-text-muted">{new Date(e.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-small text-text-muted">No audit entries</p>
        )}
      </div>
    </div>
  );
}
