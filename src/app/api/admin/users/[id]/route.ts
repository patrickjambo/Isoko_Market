import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { setUserStatus } from '@/lib/admin-users';
import { notify } from '@/lib/notifications';
import { emitAdmin } from '@/lib/admin-realtime';

const schema = z.object({
  action: z.enum(['suspend', 'ban', 'reactivate', 'verify', 'unverify']),
  reason: z.string().trim().max(500).optional(),
});

// The permission each action requires, and whether it needs a reason.
const RULES: Record<string, { perm: string; needsReason: boolean }> = {
  suspend: { perm: 'users.suspend', needsReason: true },
  ban: { perm: 'users.ban', needsReason: true },
  reactivate: { perm: 'users.reactivate', needsReason: false },
  verify: { perm: 'verification.approve', needsReason: false },
  unverify: { perm: 'verification.reject', needsReason: false },
};

/**
 * PATCH /api/admin/users/[id] — account lifecycle actions. Each action checks a
 * specific permission, requires a reason where sensitive, cascades correctly and
 * is written to the immutable audit log (returned in `meta.audit`).
 */
export const PATCH = adminRoute(
  null,
  async (req, ctx: { params: { id: string } }, { admin, permissions }) => {
    const { action, reason } = schema.parse(await req.json().catch(() => ({})));
    const rule = RULES[action]!;
    if (!permissions.has(rule.perm)) {
      throw new ApiError('FORBIDDEN', `Missing permission: ${rule.perm}`);
    }
    if (rule.needsReason && (!reason || reason.trim().length < 3)) {
      throw new ApiError('BAD_REQUEST', 'A reason is required for this action.');
    }
    if (ctx.params.id === admin.id) {
      throw new ApiError('BAD_REQUEST', 'You cannot perform this action on your own account.');
    }

    let after: Prisma.InputJsonObject = {};

    if (action === 'suspend' || action === 'ban' || action === 'reactivate') {
      const status = action === 'suspend' ? 'SUSPENDED' : action === 'ban' ? 'BANNED' : 'ACTIVE';
      const res = await setUserStatus({ userId: ctx.params.id, status, reason });
      after = { accountStatus: res.after };
    } else {
      const verified = action === 'verify';
      await prisma.user.update({
        where: { id: ctx.params.id },
        data: {
          isVerified: verified,
          verificationStatus: verified ? 'VERIFIED' : 'UNVERIFIED',
        },
      });
      after = { isVerified: verified };
      await notify({
        userId: ctx.params.id,
        type: verified ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
        title: verified ? 'Verification approved' : 'Verification updated',
        href: '/verify',
      });
      // Same admin-console broadcast as the verification queue (rule 6 parity).
      await emitAdmin(
        verified ? 'verification.approved' : 'verification.rejected',
        `Verification ${verified ? 'approved' : 'updated'}`
      );
    }

    const log = await audit({
      actorId: admin.id,
      action: `users.${action}`,
      targetType: 'USER',
      targetId: ctx.params.id,
      reason,
      after,
    });

    return { data: { id: ctx.params.id, ...after }, meta: { audit: log } };
  }
);
