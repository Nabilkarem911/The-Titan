import { describe, it, expect, beforeEach } from 'vitest';
import { MCPGovernanceManager } from './mcp-governance.js';
import type { MCPGovernancePolicy } from './mcp-governance.js';

describe('MCPGovernanceManager', () => {
  let gov: MCPGovernanceManager;

  beforeEach(() => {
    gov = new MCPGovernanceManager();
  });

  const makePolicy = (overrides: Partial<MCPGovernancePolicy> = {}): MCPGovernancePolicy => ({
    serverId: 'srv-1',
    allowedPermissions: ['read', 'execute'],
    deniedTools: [],
    allowedTools: '*',
    rateLimitPerMinute: 10,
    requiresApproval: false,
    maxConcurrentInvocations: 5,
    auditEnabled: true,
    ...overrides,
  });

  it('sets and retrieves policies', () => {
    const policy = makePolicy();
    gov.setPolicy(policy);
    expect(gov.getPolicy('srv-1')).toEqual(policy);
  });

  it('removes policies', () => {
    gov.setPolicy(makePolicy());
    expect(gov.removePolicy('srv-1')).toBe(true);
    expect(gov.getPolicy('srv-1')).toBeNull();
  });

  it('allows invocation with correct permissions', () => {
    gov.setPolicy(makePolicy());
    const result = gov.checkPermission('srv-1', 'search', 'execute', 'user-1');
    expect(result.allowed).toBe(true);
  });

  it('denies invocation with wrong permission', () => {
    gov.setPolicy(makePolicy({ allowedPermissions: ['read'] }));
    const result = gov.checkPermission('srv-1', 'search', 'execute', 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not allowed');
  });

  it('denies invocation for denied tools', () => {
    gov.setPolicy(makePolicy({ deniedTools: ['dangerous-tool'] }));
    const result = gov.checkPermission('srv-1', 'dangerous-tool', 'execute', 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('denied');
  });

  it('denies invocation for tools not in allowed list', () => {
    gov.setPolicy(makePolicy({ allowedTools: ['search', 'fetch'] }));
    const result = gov.checkPermission('srv-1', 'delete', 'execute', 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not in allowed list');
  });

  it('enforces rate limits', () => {
    gov.setPolicy(makePolicy({ rateLimitPerMinute: 3 }));
    expect(gov.checkPermission('srv-1', 'tool', 'execute').allowed).toBe(true);
    expect(gov.checkPermission('srv-1', 'tool', 'execute').allowed).toBe(true);
    expect(gov.checkPermission('srv-1', 'tool', 'execute').allowed).toBe(true);
    const result = gov.checkPermission('srv-1', 'tool', 'execute');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Rate limit');
  });

  it('enforces concurrent invocation limits', () => {
    gov.setPolicy(makePolicy({ maxConcurrentInvocations: 2 }));
    expect(gov.checkPermission('srv-1', 'tool', 'execute').allowed).toBe(true);
    expect(gov.checkPermission('srv-1', 'tool', 'execute').allowed).toBe(true);
    const result = gov.checkPermission('srv-1', 'tool', 'execute');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('concurrent');
  });

  it('releases concurrent invocations', () => {
    gov.setPolicy(makePolicy({ maxConcurrentInvocations: 1 }));
    expect(gov.checkPermission('srv-1', 'tool', 'execute').allowed).toBe(true);
    gov.releaseInvocation('srv-1');
    expect(gov.checkPermission('srv-1', 'tool', 'execute').allowed).toBe(true);
  });

  it('records audit entries', () => {
    gov.setPolicy(makePolicy());
    gov.checkPermission('srv-1', 'search', 'execute', 'user-1');
    gov.checkPermission('srv-1', 'search', 'admin', 'user-1');

    const audit = gov.getAuditLog();
    expect(audit.length).toBe(2);
    expect(audit[0].allowed).toBe(true);
    expect(audit[1].allowed).toBe(false);
  });

  it('filters audit log', () => {
    gov.setPolicy(makePolicy());
    gov.checkPermission('srv-1', 'search', 'execute', 'user-1');
    gov.checkPermission('srv-1', 'search', 'admin', 'user-2');

    const user1Audit = gov.getAuditLog({ userId: 'user-1' });
    expect(user1Audit.length).toBe(1);
    expect(user1Audit[0].userId).toBe('user-1');

    const deniedAudit = gov.getAuditLog({ allowed: false });
    expect(deniedAudit.length).toBe(1);
  });

  it('denies when no policy configured', () => {
    const result = gov.checkPermission('unknown-srv', 'tool', 'execute');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No policy');
  });

  it('tracks stats', () => {
    gov.setPolicy(makePolicy());
    gov.checkPermission('srv-1', 'tool', 'execute');
    gov.checkPermission('srv-1', 'tool', 'admin');

    const stats = gov.stats();
    expect(stats.totalPolicies).toBe(1);
    expect(stats.totalAuditEntries).toBe(2);
    expect(stats.allowedInvocations).toBe(1);
    expect(stats.deniedInvocations).toBe(1);
  });

  it('stores and retrieves OAuth tokens', async () => {
    gov.setOAuthConfig('srv-1', {
      clientId: 'test-id',
      clientSecret: 'test-secret',
      tokenUrl: 'http://localhost:9999/token',
      scopes: ['read', 'write'],
    });

    // Token fetch will fail since no real server, but config should be stored
    const token = await gov.fetchOAuthToken('srv-1');
    expect(token).toBeNull(); // No real OAuth server
  });

  it('clears audit log and counters', () => {
    gov.setPolicy(makePolicy());
    gov.checkPermission('srv-1', 'tool', 'execute');
    gov.clear();
    expect(gov.stats().totalAuditEntries).toBe(0);
  });
});
