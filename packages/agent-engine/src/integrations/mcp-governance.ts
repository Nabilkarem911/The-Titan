import { getLogger } from '@titan/logging';
import { incCounter, setGauge } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { mcpGovernanceAudit as mgaRepo } from '@titan/database';

const log = getLogger().child({ component: 'mcp-governance' });

type MCPPermission = 'read' | 'write' | 'execute' | 'admin' | 'delegate';
type MCPAuthType = 'none' | 'api_key' | 'oauth2' | 'bearer' | 'mtls';

export interface MCPGovernancePolicy {
  serverId: string;
  allowedPermissions: MCPPermission[];
  deniedTools: string[];
  allowedTools: string[] | '*';
  rateLimitPerMinute: number;
  requiresApproval: boolean;
  maxConcurrentInvocations: number;
  auditEnabled: boolean;
}

interface MCPAuditEntry {
  id: string;
  serverId: string;
  toolName: string;
  permission: MCPPermission;
  userId?: string;
  allowed: boolean;
  reason: string;
  timestamp: Date;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

interface MCPOAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri?: string;
}

interface MCPOAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scopes: string[];
}

interface MCPTransportConfig {
  type: 'http' | 'sse' | 'grpc' | 'websocket';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  reconnect?: boolean;
  maxReconnects?: number;
}

export class MCPGovernanceManager {
  private policies: Map<string, MCPGovernancePolicy> = new Map();
  private auditLog: MCPAuditEntry[] = [];
  private maxAuditEntries = 5000;
  private invocationCounts: Map<string, { count: number; windowStart: number }> = new Map();
  private activeInvocations: Map<string, number> = new Map();
  private oauthTokens: Map<string, MCPOAuthToken> = new Map();
  private oauthConfigs: Map<string, MCPOAuthConfig> = new Map();

  constructor() {}

  // ===== Policy Management =====

  setPolicy(policy: MCPGovernancePolicy): void {
    this.policies.set(policy.serverId, policy);
    setGauge('mcp_policies', 'MCP governance policies', this.policies.size);
    log.info({ serverId: policy.serverId, permissions: policy.allowedPermissions }, 'governance policy set');
  }

  getPolicy(serverId: string): MCPGovernancePolicy | null {
    return this.policies.get(serverId) ?? null;
  }

  removePolicy(serverId: string): boolean {
    return this.policies.delete(serverId);
  }

  listPolicies(): MCPGovernancePolicy[] {
    return Array.from(this.policies.values());
  }

  // ===== Permission Checking =====

  checkPermission(
    serverId: string,
    toolName: string,
    permission: MCPPermission,
    userId?: string,
  ): { allowed: boolean; reason: string } {
    const policy = this.policies.get(serverId);

    if (!policy) {
      this.recordAudit(serverId, toolName, permission, userId, false, 'No policy configured for server');
      return { allowed: false, reason: 'No policy configured for server' };
    }

    // Check permission
    if (!policy.allowedPermissions.includes(permission)) {
      this.recordAudit(serverId, toolName, permission, userId, false, `Permission ${permission} not allowed`);
      return { allowed: false, reason: `Permission ${permission} not allowed for server ${serverId}` };
    }

    // Check denied tools
    if (policy.deniedTools.includes(toolName)) {
      this.recordAudit(serverId, toolName, permission, userId, false, `Tool ${toolName} is denied`);
      return { allowed: false, reason: `Tool ${toolName} is denied for server ${serverId}` };
    }

    // Check allowed tools
    if (policy.allowedTools !== '*' && !policy.allowedTools.includes(toolName)) {
      this.recordAudit(serverId, toolName, permission, userId, false, `Tool ${toolName} not in allowed list`);
      return { allowed: false, reason: `Tool ${toolName} not in allowed list for server ${serverId}` };
    }

    // Check rate limit
    if (!this.checkRateLimit(serverId, policy.rateLimitPerMinute)) {
      this.recordAudit(serverId, toolName, permission, userId, false, 'Rate limit exceeded');
      return { allowed: false, reason: 'Rate limit exceeded' };
    }

    // Check concurrent invocations
    if (!this.checkConcurrent(serverId, policy.maxConcurrentInvocations)) {
      this.recordAudit(serverId, toolName, permission, userId, false, 'Max concurrent invocations reached');
      return { allowed: false, reason: 'Max concurrent invocations reached' };
    }

    this.recordAudit(serverId, toolName, permission, userId, true, 'Permission granted');
    return { allowed: true, reason: 'Permission granted' };
  }

  // ===== Rate Limiting =====

  private checkRateLimit(serverId: string, limitPerMinute: number): boolean {
    const now = Date.now();
    const entry = this.invocationCounts.get(serverId);

    if (!entry || now - entry.windowStart > 60_000) {
      this.invocationCounts.set(serverId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= limitPerMinute) {
      incCounter('mcp_rate_limited', 'MCP rate limited invocations', 1, { serverId });
      return false;
    }

    entry.count++;
    return true;
  }

  // ===== Concurrent Invocation Tracking =====

  private checkConcurrent(serverId: string, maxConcurrent: number): boolean {
    const current = this.activeInvocations.get(serverId) ?? 0;
    if (current >= maxConcurrent) return false;
    this.activeInvocations.set(serverId, current + 1);
    return true;
  }

  releaseInvocation(serverId: string): void {
    const current = this.activeInvocations.get(serverId) ?? 0;
    if (current > 0) {
      this.activeInvocations.set(serverId, current - 1);
    }
  }

  // ===== Audit Logging =====

  private recordAudit(
    serverId: string,
    toolName: string,
    permission: MCPPermission,
    userId: string | undefined,
    allowed: boolean,
    reason: string,
  ): void {
    const policy = this.policies.get(serverId);
    if (policy && !policy.auditEnabled && allowed) return;

    const entry: MCPAuditEntry = {
      id: randomUUID().slice(0, 8),
      serverId,
      toolName,
      permission,
      userId,
      allowed,
      reason,
      timestamp: new Date(),
    };

    this.auditLog.push(entry);
    mgaRepo.insert(entry.id, { server: entry.serverId, action: entry.toolName, policy_violated: entry.allowed ? null : entry.reason, decision: entry.allowed ? 'allow' : 'deny' }).catch((err) => log.error({ err }, 'DB write failed'));
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }

    incCounter('mcp_audit_entry', 'MCP audit entries', 1, { allowed: String(allowed), serverId });
  }

  getAuditLog(filter?: {
    serverId?: string;
    userId?: string;
    allowed?: boolean;
    limit?: number;
  }): MCPAuditEntry[] {
    let result = this.auditLog;
    if (filter?.serverId) result = result.filter(e => e.serverId === filter.serverId);
    if (filter?.userId) result = result.filter(e => e.userId === filter.userId);
    if (filter?.allowed !== undefined) result = result.filter(e => e.allowed === filter.allowed);
    const limit = filter?.limit ?? 100;
    return result.slice(-limit);
  }

  // ===== OAuth Management =====

  setOAuthConfig(serverId: string, config: MCPOAuthConfig): void {
    this.oauthConfigs.set(serverId, config);
    log.info({ serverId }, 'OAuth config set for MCP server');
  }

  async fetchOAuthToken(serverId: string): Promise<MCPOAuthToken | null> {
    const config = this.oauthConfigs.get(serverId);
    if (!config) return null;

    // Check existing token
    const existing = this.oauthTokens.get(serverId);
    if (existing && existing.expiresAt > new Date()) {
      return existing;
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: config.scopes.join(' '),
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        log.error({ serverId, status: response.status }, 'OAuth token fetch failed');
        return null;
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
        scope?: string;
      };

      const token: MCPOAuthToken = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        tokenType: data.token_type,
        scopes: data.scope ? data.scope.split(' ') : config.scopes,
      };

      this.oauthTokens.set(serverId, token);
      incCounter('mcp_oauth_token_fetched', 'MCP OAuth tokens fetched', 1, { serverId });
      log.info({ serverId, expiresAt: token.expiresAt }, 'OAuth token fetched');
      return token;
    } catch (err) {
      log.error({ err, serverId }, 'OAuth token fetch error');
      return null;
    }
  }

  getOAuthToken(serverId: string): MCPOAuthToken | null {
    const token = this.oauthTokens.get(serverId);
    if (!token || token.expiresAt <= new Date()) return null;
    return token;
  }

  // ===== Stats =====

  stats(): {
    totalPolicies: number;
    totalAuditEntries: number;
    allowedInvocations: number;
    deniedInvocations: number;
    activeConcurrentInvocations: number;
    oauthConfiguredServers: number;
  } {
    const allowed = this.auditLog.filter(e => e.allowed).length;
    const denied = this.auditLog.filter(e => !e.allowed).length;
    const concurrent = Array.from(this.activeInvocations.values()).reduce((s, c) => s + c, 0);

    return {
      totalPolicies: this.policies.size,
      totalAuditEntries: this.auditLog.length,
      allowedInvocations: allowed,
      deniedInvocations: denied,
      activeConcurrentInvocations: concurrent,
      oauthConfiguredServers: this.oauthConfigs.size,
    };
  }

  clear(): void {
    this.auditLog = [];
    this.invocationCounts.clear();
    this.activeInvocations.clear();
  }
}
