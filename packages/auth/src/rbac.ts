import {
  ROLE_PERMISSIONS,
  ROLES,
  ROLE_HIERARCHY,
  roleAtOrBelow,
  type Role,
  type Permission,
} from '@titan/shared';

export function getPermissionsForRole(role: string): readonly Permission[] {
  if (role in ROLE_PERMISSIONS) {
    return ROLE_PERMISSIONS[role as Role];
  }
  return [];
}

export function hasPermission(granted: readonly Permission[], required: Permission): boolean {
  return granted.includes(required);
}

export function hasAnyPermission(granted: readonly Permission[], required: readonly Permission[]): boolean {
  return required.some((p) => granted.includes(p));
}

export function isValidRole(role: string): role is Role {
  return Object.values(ROLES).includes(role as Role);
}

export function isPermission(value: string): value is Permission {
  return (Object.values(ROLES) as string[]).length > 0
    ? (Object.values(ROLE_PERMISSIONS).flat() as string[]).includes(value)
    : false;
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (!isValidRole(actorRole) || !isValidRole(targetRole)) return false;
  return roleAtOrBelow(actorRole, targetRole);
}

export function roleRank(role: string): number {
  return ROLE_HIERARCHY[role as Role] ?? 0;
}
