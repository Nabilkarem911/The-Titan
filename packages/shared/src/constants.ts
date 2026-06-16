/**
 * Titan shared constants used across all packages.
 */

export const SERVICE_NAME = 'titan';
export const SERVICE_VERSION = '0.1.0';

export const QUEUE_NAMES = {
  AGENT_EXECUTE: 'agent-execute',
  TOOL_EXECUTE: 'tool-execute',
  MEMORY_INDEX: 'memory-index',
  MEMORY_RETRIEVE: 'memory-retrieve',
  SANDBOX_EXEC: 'sandbox-exec',
  MONITORING_CHECK: 'monitoring-check',
  AUDIT_WRITE: 'audit-write',
  WEBHOOK_DELIVER: 'webhook-deliver',
  SWARM_EXECUTE: 'swarm-execute',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const ALL_QUEUES: readonly QueueName[] = Object.values(QUEUE_NAMES);

export const QUEUE_PRIORITY = {
  CRITICAL: 10,
  HIGH: 7,
  MEDIUM: 5,
  LOW: 2,
} as const;

export const WS_PROTOCOL_VERSION = '2.0';
export const WS_PING_INTERVAL_MS = 30_000;
export const WS_PING_TIMEOUT_MS = 10_000;
export const WS_MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.OWNER]: 4,
  [ROLES.ADMIN]: 3,
  [ROLES.MEMBER]: 2,
  [ROLES.VIEWER]: 1,
};

export function roleAtOrBelow(actorRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY[targetRole];
}

export const PERMISSIONS = {
  WORKSPACE_READ: 'workspace:read',
  WORKSPACE_WRITE: 'workspace:write',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_ADMIN: 'workspace:admin',
  AGENT_READ: 'agent:read',
  AGENT_WRITE: 'agent:write',
  AGENT_EXECUTE: 'agent:execute',
  TOOL_READ: 'tool:read',
  TOOL_EXECUTE: 'tool:execute',
  MEMORY_READ: 'memory:read',
  MEMORY_WRITE: 'memory:write',
  SANDBOX_READ: 'sandbox:read',
  SANDBOX_EXECUTE: 'sandbox:execute',
  MONITORING_READ: 'monitoring:read',
  AUDIT_READ: 'audit:read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.OWNER]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.WORKSPACE_WRITE,
    PERMISSIONS.WORKSPACE_ADMIN,
    PERMISSIONS.AGENT_READ,
    PERMISSIONS.AGENT_WRITE,
    PERMISSIONS.AGENT_EXECUTE,
    PERMISSIONS.TOOL_READ,
    PERMISSIONS.TOOL_EXECUTE,
    PERMISSIONS.MEMORY_READ,
    PERMISSIONS.MEMORY_WRITE,
    PERMISSIONS.SANDBOX_READ,
    PERMISSIONS.SANDBOX_EXECUTE,
    PERMISSIONS.MONITORING_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  [ROLES.MEMBER]: [
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.AGENT_READ,
    PERMISSIONS.AGENT_WRITE,
    PERMISSIONS.AGENT_EXECUTE,
    PERMISSIONS.TOOL_READ,
    PERMISSIONS.TOOL_EXECUTE,
    PERMISSIONS.MEMORY_READ,
    PERMISSIONS.MEMORY_WRITE,
    PERMISSIONS.SANDBOX_READ,
    PERMISSIONS.SANDBOX_EXECUTE,
    PERMISSIONS.MONITORING_READ,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.AGENT_READ,
    PERMISSIONS.TOOL_READ,
    PERMISSIONS.MEMORY_READ,
    PERMISSIONS.SANDBOX_READ,
    PERMISSIONS.MONITORING_READ,
  ],
};

export const AUDIT_ACTIONS = {
  USER_CREATED: 'user.created',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  API_KEY_CREATED: 'api_key.created',
  API_KEY_REVOKED: 'api_key.revoked',
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_DELETED: 'workspace.deleted',
  AGENT_RUN_STARTED: 'agent.run.started',
  AGENT_RUN_COMPLETED: 'agent.run.completed',
  AGENT_RUN_FAILED: 'agent.run.failed',
  TOOL_EXECUTED: 'tool.executed',
  TOOL_FAILED: 'tool.failed',
  SANDBOX_EXECUTED: 'sandbox.executed',
  MEMORY_WRITTEN: 'memory.written',
  MEMORY_READ: 'memory.read',
  UNAUTHORIZED_ACCESS: 'auth.unauthorized',
  RATE_LIMIT_EXCEEDED: 'rate_limit.exceeded',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const ERROR_CODES = {
  UNAUTHORIZED: 'E1001',
  INVALID_TOKEN: 'E1002',
  EXPIRED_TOKEN: 'E1003',
  INVALID_CREDENTIALS: 'E1004',
  INSUFFICIENT_PERMISSIONS: 'E1005',
  API_KEY_INVALID: 'E1006',
  API_KEY_REVOKED: 'E1007',
  VALIDATION_FAILED: 'E2001',
  INVALID_INPUT: 'E2002',
  MISSING_FIELD: 'E2003',
  NOT_FOUND: 'E3001',
  ALREADY_EXISTS: 'E3002',
  CONFLICT: 'E3003',
  RATE_LIMITED: 'E4001',
  QUOTA_EXCEEDED: 'E4002',
  INTERNAL: 'E5001',
  NOT_IMPLEMENTED: 'E5002',
  SERVICE_UNAVAILABLE: 'E5003',
  DATABASE_ERROR: 'E5004',
  QUEUE_ERROR: 'E5005',
  EXTERNAL_SERVICE_ERROR: 'E5006',
  WS_PROTOCOL_ERROR: 'E6001',
  WS_AUTH_FAILED: 'E6002',
  WS_METHOD_NOT_FOUND: 'E6003',
  WS_INVALID_PARAMS: 'E6004',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  E1001: 401,
  E1002: 401,
  E1003: 401,
  E1004: 401,
  E1005: 403,
  E1006: 401,
  E1007: 401,
  E2001: 400,
  E2002: 400,
  E2003: 400,
  E3001: 404,
  E3002: 409,
  E3003: 409,
  E4001: 429,
  E4002: 429,
  E5001: 500,
  E5002: 501,
  E5003: 503,
  E5004: 500,
  E5005: 500,
  E5006: 502,
  E6001: 400,
  E6002: 401,
  E6003: 404,
  E6004: 400,
};
