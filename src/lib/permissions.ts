import 'server-only';
import type { User } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Granular permission catalog for the admin area. Every sensitive action is
 * gated by a specific key (checked server-side), never merely "is admin".
 * Keys are grouped by module for the permission-matrix UI.
 */
export const PERMISSION_MODULES: { module: string; keys: string[] }[] = [
  { module: 'users', keys: ['users.view', 'users.suspend', 'users.ban', 'users.reactivate'] },
  {
    module: 'verification',
    keys: ['verification.view', 'verification.approve', 'verification.reject'],
  },
  { module: 'listings', keys: ['listings.view', 'listings.remove', 'listings.feature'] },
  { module: 'jobs', keys: ['jobs.view', 'jobs.close'] },
  { module: 'transactions', keys: ['transactions.view', 'transactions.refund'] },
  { module: 'moderation', keys: ['moderation.view', 'moderation.resolve'] },
  { module: 'messages', keys: ['messages.oversight'] },
  { module: 'partners', keys: ['partners.view', 'partners.manage'] },
  { module: 'analytics', keys: ['analytics.view', 'analytics.export'] },
  { module: 'content', keys: ['content.view', 'content.edit'] },
  { module: 'roles', keys: ['roles.view', 'roles.manage'] },
  { module: 'audit', keys: ['audit.view'] },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_MODULES.flatMap((m) => m.keys);

export type AdminRoleName =
  | 'SUPER_ADMIN'
  | 'MODERATOR'
  | 'SUPPORT'
  | 'FINANCE_ADMIN'
  | 'READONLY_ANALYST';

const VIEW_ONLY = ALL_PERMISSIONS.filter((k) => k.endsWith('.view'));

/** Default permission set granted by each admin role. */
export const ROLE_DEFAULTS: Record<AdminRoleName, string[] | '*'> = {
  SUPER_ADMIN: '*',
  MODERATOR: [
    'users.view',
    'verification.view',
    'verification.approve',
    'verification.reject',
    'listings.view',
    'listings.remove',
    'jobs.view',
    'jobs.close',
    'moderation.view',
    'moderation.resolve',
    'messages.oversight',
    'audit.view',
  ],
  SUPPORT: ['users.view', 'verification.view', 'moderation.view', 'audit.view'],
  FINANCE_ADMIN: [
    'users.view',
    'transactions.view',
    'transactions.refund',
    'analytics.view',
    'analytics.export',
    'audit.view',
  ],
  READONLY_ANALYST: [...VIEW_ONLY, 'analytics.export'],
};

/** The permissions a role grants by default (before per-admin overrides). */
export function roleDefaults(role: AdminRoleName): Set<string> {
  const d = ROLE_DEFAULTS[role];
  return new Set(d === '*' ? ALL_PERMISSIONS : d);
}

export type PermissionOverrideRow = {
  permissionKey: string;
  granted: boolean;
  expiresAt: Date | null;
};

/**
 * Pure override-merge — the single source of truth for how per-admin overrides
 * combine with role defaults. Rules:
 *   • an EXPIRED override is ignored entirely (behaves as if it didn't exist);
 *   • a DENY (granted=false) wins over a role-default grant;
 *   • a GRANT (granted=true) adds a permission the role wouldn't otherwise have.
 * Extracted so this security-critical logic is unit-testable without a DB.
 */
export function mergeOverrides(
  base: Set<string>,
  overrides: PermissionOverrideRow[],
  now: Date = new Date()
): Set<string> {
  const result = new Set(base);
  for (const o of overrides) {
    if (o.expiresAt && o.expiresAt <= now) continue; // time-bound grant lapsed
    if (o.granted) result.add(o.permissionKey);
    else result.delete(o.permissionKey); // deny wins
  }
  return result;
}

/**
 * Effective permissions for an admin: role defaults merged with per-admin
 * overrides via {@link mergeOverrides}. SUPER_ADMIN always has everything.
 */
export async function effectivePermissions(user: Pick<User, 'id' | 'adminRole'>): Promise<Set<string>> {
  if (!user.adminRole) return new Set();
  if (user.adminRole === 'SUPER_ADMIN') return new Set(ALL_PERMISSIONS);

  const base = roleDefaults(user.adminRole as AdminRoleName);
  // Fetch all overrides for the user; expiry is applied by mergeOverrides so the
  // rule lives in exactly one place.
  const overrides = await prisma.userPermissionOverride.findMany({ where: { userId: user.id } });
  return mergeOverrides(base, overrides, new Date());
}

export function can(permissions: Set<string>, key: string): boolean {
  return permissions.has(key);
}

/**
 * Resolved permission matrix for the roles UI: for each key, whether it's
 * effectively granted and whether that came from the role or an explicit override.
 */
export async function permissionMatrix(user: Pick<User, 'id' | 'adminRole'>) {
  // A role-less admin grants nothing by role (empty defaults) — the matrix shows
  // every key as un-granted, honestly reflecting their empty effective set.
  const defaults = user.adminRole ? roleDefaults(user.adminRole as AdminRoleName) : new Set<string>();
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId: user.id },
  });
  const overrideMap = new Map(overrides.map((o) => [o.permissionKey, o]));

  return ALL_PERMISSIONS.map((key) => {
    const override = overrideMap.get(key);
    const roleGrants = user.adminRole === 'SUPER_ADMIN' || defaults.has(key);
    const effective = override ? override.granted : roleGrants;
    return {
      key,
      roleGrants,
      source: override ? ('override' as const) : ('role' as const),
      state: override ? (override.granted ? 'grant' : 'deny') : 'inherit',
      effective,
      expiresAt: override?.expiresAt ? override.expiresAt.toISOString() : null,
    };
  });
}
