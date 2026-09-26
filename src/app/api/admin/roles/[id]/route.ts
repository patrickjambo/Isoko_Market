import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { emitAdmin } from '@/lib/admin-realtime';
import { permissionMatrix, PERMISSION_MODULES, ALL_PERMISSIONS } from '@/lib/permissions';
import { generatePassword, hashPassword } from '@/lib/password';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE_ADMIN', 'READONLY_ANALYST'] as const;

/** GET /api/admin/roles/[id] — an admin's resolved permission matrix. */
export const GET = adminRoute('roles.view', async (_req, ctx: { params: { id: string } }) => {
  const target = await prisma.user.findFirst({
    where: { id: ctx.params.id, role: 'ADMIN' },
    select: { id: true, fullName: true, adminRole: true, accountStatus: true },
  });
  if (!target) throw new ApiError('NOT_FOUND', 'Admin not found.');

  // Show the admin's REAL sub-role (null if unassigned) — never mislabel a
  // role-less admin as SUPER_ADMIN. The matrix reflects their true (empty) role
  // grants so a super-admin sees they must assign a role.
  const matrix = await permissionMatrix(target);

  return {
    data: {
      admin: target,
      modules: PERMISSION_MODULES,
      matrix,
    },
  };
});

const patchSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('setRole'), adminRole: z.enum(ADMIN_ROLES) }),
  z.object({ op: z.literal('resetPassword') }),
  z.object({ op: z.literal('setStatus'), status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().max(300).optional() }),
  z.object({
    op: z.literal('setPermission'),
    permissionKey: z.string().refine((k) => ALL_PERMISSIONS.includes(k), 'Unknown permission'),
    state: z.enum(['grant', 'deny', 'inherit']),
    reason: z.string().trim().max(300).optional(),
    expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
  }),
]);

/**
 * PATCH /api/admin/roles/[id] — change an admin's role, or set an explicit
 * grant/deny/inherit override for a single permission (deny wins; optional
 * time-bound expiry). SuperAdmin only via `roles.manage`. Every change audited.
 */
export const PATCH = adminRoute(
  'roles.manage',
  async (req, ctx: { params: { id: string } }, { admin }) => {
    const body = patchSchema.parse(await req.json().catch(() => ({})));

    const target = await prisma.user.findFirst({
      where: { id: ctx.params.id, role: 'ADMIN' },
      select: { id: true, adminRole: true, accountStatus: true, sessionVersion: true },
    });
    if (!target) throw new ApiError('NOT_FOUND', 'Admin not found.');

    if (body.op === 'resetPassword') {
      // Generate a fresh temporary password, revoke the admin's existing sessions
      // (sessionVersion bump) and hand the plaintext back ONCE for the super admin
      // to relay. They should change it under Admin → Account after logging in.
      const password = generatePassword();
      await prisma.user.update({
        where: { id: target.id },
        data: { passwordHash: await hashPassword(password), sessionVersion: target.sessionVersion + 1 },
      });
      const log = await audit({
        actorId: admin.id,
        action: 'roles.resetPassword',
        targetType: 'USER',
        targetId: target.id,
      });
      await emitAdmin('permission.changed', 'Staff password reset');
      return { data: { password }, meta: { audit: log } };
    }

    if (body.op === 'setStatus') {
      const deactivating = body.status !== 'ACTIVE';
      if (target.id === admin.id) {
        throw new ApiError('BAD_REQUEST', 'You cannot change your own account status.');
      }
      // Never deactivate the last active Super Admin.
      if (deactivating && target.adminRole === 'SUPER_ADMIN') {
        const activeSupers = await prisma.user.count({
          where: { role: 'ADMIN', adminRole: 'SUPER_ADMIN', accountStatus: 'ACTIVE' },
        });
        if (activeSupers <= 1) throw new ApiError('BAD_REQUEST', 'At least one active Super Admin is required.');
      }
      await prisma.user.update({
        where: { id: target.id },
        data: {
          accountStatus: body.status,
          statusReason: deactivating ? (body.reason ?? null) : null,
          // Deactivating revokes any live sessions immediately.
          ...(deactivating ? { sessionVersion: target.sessionVersion + 1 } : {}),
        },
      });
      const log = await audit({
        actorId: admin.id,
        action: deactivating ? 'roles.deactivate' : 'roles.activate',
        targetType: 'USER',
        targetId: target.id,
        reason: body.reason,
        before: { accountStatus: target.accountStatus },
        after: { accountStatus: body.status },
      });
      await emitAdmin('permission.changed', `Staff ${deactivating ? 'deactivated' : 'activated'}`);
      return { data: { accountStatus: body.status }, meta: { audit: log } };
    }

    if (body.op === 'setRole') {
      // Never leave the platform without a SUPER_ADMIN.
      if (target.adminRole === 'SUPER_ADMIN' && body.adminRole !== 'SUPER_ADMIN') {
        const supers = await prisma.user.count({ where: { role: 'ADMIN', adminRole: 'SUPER_ADMIN' } });
        if (supers <= 1) throw new ApiError('BAD_REQUEST', 'At least one Super Admin is required.');
      }
      await prisma.user.update({ where: { id: target.id }, data: { adminRole: body.adminRole } });
      const log = await audit({
        actorId: admin.id,
        action: 'roles.setRole',
        targetType: 'USER',
        targetId: target.id,
        before: { adminRole: target.adminRole },
        after: { adminRole: body.adminRole },
      });
      // Live-signal other admin consoles (rule 6 gap: admin:permissionChanged).
      await emitAdmin('permission.changed', `Admin role set to ${body.adminRole}`);
      return { data: { adminRole: body.adminRole }, meta: { audit: log } };
    }

    // setPermission
    if (body.state === 'inherit') {
      await prisma.userPermissionOverride
        .delete({ where: { userId_permissionKey: { userId: target.id, permissionKey: body.permissionKey } } })
        .catch(() => null);
    } else {
      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
        : null;
      await prisma.userPermissionOverride.upsert({
        where: { userId_permissionKey: { userId: target.id, permissionKey: body.permissionKey } },
        create: {
          userId: target.id,
          permissionKey: body.permissionKey,
          granted: body.state === 'grant',
          reason: body.reason,
          expiresAt,
          createdById: admin.id,
        },
        update: { granted: body.state === 'grant', reason: body.reason, expiresAt, createdById: admin.id },
      });
    }

    const log = await audit({
      actorId: admin.id,
      action: body.state === 'grant' ? 'permission.grant' : body.state === 'deny' ? 'permission.deny' : 'permission.inherit',
      targetType: 'PERMISSION',
      targetId: `${target.id}:${body.permissionKey}`,
      reason: body.reason,
      after: { permissionKey: body.permissionKey, state: body.state },
    });

    // Live-signal other admin consoles (rule 6 gap: admin:permissionChanged).
    await emitAdmin('permission.changed', `Permission ${body.state}: ${body.permissionKey}`);

    const matrix = await permissionMatrix({ id: target.id, adminRole: target.adminRole ?? 'SUPER_ADMIN' });
    return { data: { matrix }, meta: { audit: log } };
  }
);
