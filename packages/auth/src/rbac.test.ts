import { describe, it, expect } from 'vitest';
import {
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  isValidRole,
  isPermission,
  canAssignRole,
  roleRank,
} from './rbac.js';
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS } from '@titan/shared';

describe('getPermissionsForRole', () => {
  it('returns all permissions for owner', () => {
    const perms = getPermissionsForRole('owner');
    expect(perms).toHaveLength(Object.values(PERMISSIONS).length);
  });

  it('returns read-only permissions for viewer', () => {
    const perms = getPermissionsForRole('viewer');
    for (const p of perms) {
      expect(p).toMatch(/:read$/);
    }
  });

  it('returns empty array for unknown role', () => {
    expect(getPermissionsForRole('unknown')).toEqual([]);
  });

  it('returns subset for member', () => {
    const perms = getPermissionsForRole('member');
    expect(perms).toContain(PERMISSIONS.AGENT_EXECUTE);
    expect(perms).not.toContain(PERMISSIONS.WORKSPACE_ADMIN);
  });
});

describe('hasPermission', () => {
  it('returns true when permission is granted', () => {
    expect(hasPermission([PERMISSIONS.AGENT_READ], PERMISSIONS.AGENT_READ)).toBe(true);
  });

  it('returns false when permission is missing', () => {
    expect(hasPermission([PERMISSIONS.AGENT_READ], PERMISSIONS.AGENT_WRITE)).toBe(false);
  });

  it('returns false for empty granted list', () => {
    expect(hasPermission([], PERMISSIONS.AGENT_READ)).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('returns true when at least one permission matches', () => {
    expect(hasAnyPermission([PERMISSIONS.AGENT_READ, PERMISSIONS.TOOL_READ], [PERMISSIONS.TOOL_EXECUTE, PERMISSIONS.TOOL_READ])).toBe(true);
  });

  it('returns false when none match', () => {
    expect(hasAnyPermission([PERMISSIONS.AGENT_READ], [PERMISSIONS.TOOL_READ])).toBe(false);
  });

  it('returns false for empty granted list', () => {
    expect(hasAnyPermission([], [PERMISSIONS.AGENT_READ])).toBe(false);
  });
});

describe('isValidRole', () => {
  it('accepts known roles', () => {
    expect(isValidRole('owner')).toBe(true);
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('member')).toBe(true);
    expect(isValidRole('viewer')).toBe(true);
  });

  it('rejects unknown roles', () => {
    expect(isValidRole('superadmin')).toBe(false);
    expect(isValidRole('')).toBe(false);
  });
});

describe('isPermission', () => {
  it('accepts known permissions', () => {
    expect(isPermission('agent:read')).toBe(true);
    expect(isPermission('workspace:admin')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isPermission('unknown:thing')).toBe(false);
    expect(isPermission('')).toBe(false);
  });
});

describe('canAssignRole', () => {
  it('allows owner to assign any role', () => {
    expect(canAssignRole('owner', 'admin')).toBe(true);
    expect(canAssignRole('owner', 'viewer')).toBe(true);
  });

  it('allows admin to assign member or viewer', () => {
    expect(canAssignRole('admin', 'member')).toBe(true);
    expect(canAssignRole('admin', 'viewer')).toBe(true);
    expect(canAssignRole('admin', 'admin')).toBe(true);
    expect(canAssignRole('admin', 'owner')).toBe(false);
  });

  it('prevents member from assigning admin', () => {
    expect(canAssignRole('member', 'admin')).toBe(false);
  });

  it('rejects invalid roles', () => {
    expect(canAssignRole('owner', 'invalid')).toBe(false);
    expect(canAssignRole('invalid', 'viewer')).toBe(false);
  });
});

describe('roleRank', () => {
  it('returns correct hierarchy values', () => {
    expect(roleRank('owner')).toBe(4);
    expect(roleRank('admin')).toBe(3);
    expect(roleRank('member')).toBe(2);
    expect(roleRank('viewer')).toBe(1);
  });

  it('returns 0 for unknown role', () => {
    expect(roleRank('unknown')).toBe(0);
  });
});

describe('ROLE_PERMISSIONS consistency', () => {
  it('every role in ROLES has a ROLE_PERMISSIONS entry', () => {
    for (const role of Object.values(ROLES)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it('owner has strictly more permissions than admin', () => {
    expect(ROLE_PERMISSIONS.owner.length).toBeGreaterThan(ROLE_PERMISSIONS.admin.length);
  });

  it('admin has strictly more permissions than member', () => {
    expect(ROLE_PERMISSIONS.admin.length).toBeGreaterThan(ROLE_PERMISSIONS.member.length);
  });

  it('member has strictly more permissions than viewer', () => {
    expect(ROLE_PERMISSIONS.member.length).toBeGreaterThan(ROLE_PERMISSIONS.viewer.length);
  });
});
