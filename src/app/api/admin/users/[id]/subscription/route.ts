import { z } from 'zod';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { ApiError } from '@/lib/api';
import { notify } from '@/lib/notifications';

const patchSchema = z.object({
  action: z.enum(['grant', 'revoke']),
  plan: z.enum(['MONTHLY', 'ANNUAL']).optional(),
  days: z.number().int().min(1).optional(),
});

const DAYS_MONTHLY = 30;
const DAYS_ANNUAL = 365;

/**
 * PATCH /api/admin/users/[id]/subscription — admin grants or revokes a seller's subscription.
 * body: { action: 'grant' | 'revoke', plan?: 'MONTHLY' | 'ANNUAL', days?: number }
 */
export const PATCH = adminRoute(
  'users.manage',
  async (req, ctx: { params: { id: string } }, { admin }) => {
    const { id } = ctx.params;
    const input = patchSchema.parse(await req.json().catch(() => ({})));

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!user) throw new ApiError('NOT_FOUND', 'User not found.');

    const before = {
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
    };

    let after: {
      subscriptionStatus: string;
      subscriptionPlan: string | null;
      subscriptionExpiresAt: string | null;
    };

    if (input.action === 'grant') {
      const plan = input.plan ?? 'MONTHLY';
      const days = input.days ?? (plan === 'ANNUAL' ? DAYS_ANNUAL : DAYS_MONTHLY);
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionPlan: plan,
          subscriptionExpiresAt: expiresAt,
        },
      });

      after = {
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: plan,
        subscriptionExpiresAt: expiresAt.toISOString(),
      };

      await notify({
        userId: id,
        type: 'SYSTEM',
        title: 'Subscription granted',
        body: `An admin has granted you a ${plan.toLowerCase()} subscription until ${expiresAt.toLocaleDateString()}.`,
        href: '/profile',
      });
    } else {
      await prisma.user.update({
        where: { id },
        data: {
          subscriptionStatus: 'EXPIRED',
          subscriptionPlan: null,
          subscriptionExpiresAt: null,
        },
      });

      after = {
        subscriptionStatus: 'EXPIRED',
        subscriptionPlan: null,
        subscriptionExpiresAt: null,
      };

      await notify({
        userId: id,
        type: 'SYSTEM',
        title: 'Subscription revoked',
        body: 'Your seller subscription has been revoked by an admin.',
        href: '/profile',
      });
    }

    await audit({
      actorId: admin.id,
      action: `subscription.${input.action}`,
      targetType: 'USER',
      targetId: id,
      before,
      after,
    });

    return { data: after };
  }
);
