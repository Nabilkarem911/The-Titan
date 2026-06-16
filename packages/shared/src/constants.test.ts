import { describe, it, expect } from 'vitest';
import {
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
});

describe('AUDIT_ACTIONS', () => {
  it('all actions use dot notation', () => {
    for (const action of Object.values(AUDIT_ACTIONS)) {
      expect(action).toContain('.');
    }
  });
});

describe('ERROR_CODES', () => {
  it('has E-prefixed 4-digit codes', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(code).toMatch(/^E\d{4}$/);
    }
  });
});

describe('ERROR_HTTP_STATUS', () => {
  it('maps every error code to a status', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_HTTP_STATUS[code]).toBeDefined();
    }
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
