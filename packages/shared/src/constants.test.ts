import { describe, it, expect } from 'vitest';
import {
  SERVICE_NAME,
  SERVICE_VERSION,
  QUEUE_NAMES,
  ALL_QUEUES,
  QUEUE_PRIORITY,
  ROLES,
  ROLE_HIERARCHY,
  roleAtOrBelow,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  AUDIT_ACTIONS,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  WS_PROTOCOL_VERSION,
  WS_PING_INTERVAL_MS,
  WS_PING_TIMEOUT_MS,
  WS_MAX_PAYLOAD_BYTES,
} from './constants.js';

describe('SERVICE_NAME and SERVICE_VERSION', () => {
  it('SERVICE_NAME is "titan"', () => {
    expect(SERVICE_NAME).toBe('titan');
  });

  it('SERVICE_VERSION is a semver string', () => {
    expect(SERVICE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('QUEUE_NAMES', () => {
  it('has 9 queues', () => {
    expect(ALL_QUEUES).toHaveLength(9);
  });

  it('does not contain colons (BullMQ requirement)', () => {
    for (const name of ALL_QUEUES) {
      expect(name).not.toContain(':');
    }
  });

  it('matches exported constants', () => {
    expect(QUEUE_NAMES.AGENT_EXECUTE).toBe('agent-execute');
    expect(QUEUE_NAMES.AUDIT_WRITE).toBe('audit-write');
  });

  it('ALL_QUEUES contains exactly the values from QUEUE_NAMES', () => {
    const fromObject = Object.values(QUEUE_NAMES);
    expect([...ALL_QUEUES].sort()).toEqual([...fromObject].sort());
  });

  it('all queue names are unique', () => {
    const set = new Set(ALL_QUEUES);
    expect(set.size).toBe(ALL_QUEUES.length);
  });
});

describe('QUEUE_PRIORITY', () => {
  it('has ascending numeric values', () => {
    expect(QUEUE_PRIORITY.CRITICAL).toBeGreaterThan(QUEUE_PRIORITY.HIGH);
    expect(QUEUE_PRIORITY.HIGH).toBeGreaterThan(QUEUE_PRIORITY.MEDIUM);
    expect(QUEUE_PRIORITY.MEDIUM).toBeGreaterThan(QUEUE_PRIORITY.LOW);
  });
});

describe('ROLES and ROLE_HIERARCHY', () => {
  it('has 4 roles', () => {
    expect(Object.values(ROLES)).toHaveLength(4);
  });

  it('owner is highest rank', () => {
    expect(ROLE_HIERARCHY.owner).toBe(4);
    expect(ROLE_HIERARCHY.viewer).toBe(1);
  });

  it('roleAtOrBelow works correctly', () => {
    expect(roleAtOrBelow('owner', 'viewer')).toBe(true);
    expect(roleAtOrBelow('viewer', 'owner')).toBe(false);
    expect(roleAtOrBelow('admin', 'admin')).toBe(true);
    expect(roleAtOrBelow('member', 'viewer')).toBe(true);
    expect(roleAtOrBelow('viewer', 'member')).toBe(false);
  });
});

describe('PERMISSIONS', () => {
  it('has 16 permissions', () => {
    expect(Object.values(PERMISSIONS)).toHaveLength(16);
  });

  it('permissions are namespaced with colon', () => {
    for (const perm of Object.values(PERMISSIONS)) {
      expect(perm).toContain(':');
    }
  });
});

describe('ROLE_PERMISSIONS', () => {
  it('owner has all permissions', () => {
    expect(ROLE_PERMISSIONS.owner).toHaveLength(Object.values(PERMISSIONS).length);
  });

  it('viewer has read-only permissions', () => {
    const viewerPerms = ROLE_PERMISSIONS.viewer;
    for (const perm of viewerPerms) {
      expect(perm).toMatch(/:read$/);
    }
  });

  it('admin has more than member', () => {
    expect(ROLE_PERMISSIONS.admin.length).toBeGreaterThan(ROLE_PERMISSIONS.member.length);
  });

  it('member has more than viewer', () => {
    expect(ROLE_PERMISSIONS.member.length).toBeGreaterThan(ROLE_PERMISSIONS.viewer.length);
  });

  it('member does not have workspace:write or workspace:delete', () => {
    expect(ROLE_PERMISSIONS.member).not.toContain(PERMISSIONS.WORKSPACE_WRITE);
    expect(ROLE_PERMISSIONS.member).not.toContain(PERMISSIONS.WORKSPACE_DELETE);
  });

  it('viewer permissions are a subset of member permissions', () => {
    for (const perm of ROLE_PERMISSIONS.viewer) {
      expect(ROLE_PERMISSIONS.member).toContain(perm);
    }
  });
});

describe('AUDIT_ACTIONS', () => {
  it('all actions use dot notation', () => {
    for (const action of Object.values(AUDIT_ACTIONS)) {
      expect(action).toContain('.');
    }
  });

  it('has 18 audit actions', () => {
    expect(Object.values(AUDIT_ACTIONS)).toHaveLength(18);
  });

  it('all action values are unique', () => {
    const values = Object.values(AUDIT_ACTIONS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('ERROR_CODES', () => {
  it('has E-prefixed 4-digit codes', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(code).toMatch(/^E\d{4}$/);
    }
  });

  it('all error code values are unique', () => {
    const values = Object.values(ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('ERROR_HTTP_STATUS', () => {
  it('maps every error code to a status', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_HTTP_STATUS[code]).toBeDefined();
    }
  });

  it('all HTTP status codes are valid (between 100 and 599)', () => {
    for (const status of Object.values(ERROR_HTTP_STATUS)) {
      expect(status).toBeGreaterThanOrEqual(100);
      expect(status).toBeLessThanOrEqual(599);
    }
  });

  it('auth error codes map to 401 or 403', () => {
    expect(ERROR_HTTP_STATUS[ERROR_CODES.UNAUTHORIZED]).toBe(401);
    expect(ERROR_HTTP_STATUS[ERROR_CODES.INVALID_TOKEN]).toBe(401);
    expect(ERROR_HTTP_STATUS[ERROR_CODES.EXPIRED_TOKEN]).toBe(401);
    expect(ERROR_HTTP_STATUS[ERROR_CODES.INSUFFICIENT_PERMISSIONS]).toBe(403);
  });

  it('not-found maps to 404', () => {
    expect(ERROR_HTTP_STATUS[ERROR_CODES.NOT_FOUND]).toBe(404);
  });

  it('rate-limit codes map to 429', () => {
    expect(ERROR_HTTP_STATUS[ERROR_CODES.RATE_LIMITED]).toBe(429);
    expect(ERROR_HTTP_STATUS[ERROR_CODES.QUOTA_EXCEEDED]).toBe(429);
  });

  it('internal error codes map to 5xx', () => {
    expect(ERROR_HTTP_STATUS[ERROR_CODES.INTERNAL]).toBe(500);
    expect(ERROR_HTTP_STATUS[ERROR_CODES.NOT_IMPLEMENTED]).toBe(501);
    expect(ERROR_HTTP_STATUS[ERROR_CODES.SERVICE_UNAVAILABLE]).toBe(503);
  });
});

describe('WebSocket constants', () => {
  it('has expected values', () => {
    expect(WS_PROTOCOL_VERSION).toBe('2.0');
    expect(WS_PING_INTERVAL_MS).toBe(30_000);
    expect(WS_PING_TIMEOUT_MS).toBe(10_000);
    expect(WS_MAX_PAYLOAD_BYTES).toBe(10 * 1024 * 1024);
  });
});
