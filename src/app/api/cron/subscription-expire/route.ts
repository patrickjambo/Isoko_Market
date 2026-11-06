import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * GET /api/cron/subscription-expire — expire/grace seller subscriptions.
 * Called by Vercel cron or manually triggered by an admin.
 *
 * Logic:
 * - ACTIVE  subscription where expiresAt < now - 7 days → EXPIRED
 * - ACTIVE  subscription where expiresAt < now           → GRACE
 * - GRACE   subscription where expiresAt < now - 7 days → EXPIRED
 */
export const GET = adminRoute('settings.manage', async () => {
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_MS);

  // 1. ACTIVE → EXPIRED: expiresAt passed the full 7-day grace period
  const expiredFromActive = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: { lt: graceCutoff },
    },
    select: { id: true, fullName: true },
  });

  if (expiredFromActive.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: { in: expiredFromActive.map((u) => u.id) },
      },
      data: { subscriptionStatus: 'EXPIRED' },
    });

    // Notify each expired seller
    for (const seller of expiredFromActive) {
      await notify({
        userId: seller.id,
        type: 'SYSTEM',
        title: 'Subscription expired',
        body: 'Your seller subscription has expired. Resubscribe to continue selling.',
        href: '/profile',
      });
    }
  }

  // 2. ACTIVE → GRACE: expiresAt is in the past but within 7-day grace window
  const gracedFromActive = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: { lt: now, gte: graceCutoff },
    },
    select: { id: true, fullName: true },
  });

  if (gracedFromActive.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: { in: gracedFromActive.map((u) => u.id) },
      },
      data: { subscriptionStatus: 'GRACE' },
    });

    // Notify each seller entering grace period
    for (const seller of gracedFromActive) {
      await notify({
        userId: seller.id,
        type: 'SYSTEM',
        title: 'Subscription grace period',
        body: 'Your subscription has expired. You have 7 days to renew before access is restricted.',
        href: '/profile',
      });
    }
  }

  // 3. GRACE → EXPIRED: expiresAt passed the full 7-day grace period
  const expiredFromGrace = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'GRACE',
      subscriptionExpiresAt: { lt: graceCutoff },
    },
    select: { id: true, fullName: true },
  });

  if (expiredFromGrace.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: { in: expiredFromGrace.map((u) => u.id) },
      },
      data: { subscriptionStatus: 'EXPIRED' },
    });

    for (const seller of expiredFromGrace) {
      await notify({
        userId: seller.id,
        type: 'SYSTEM',
        title: 'Subscription expired',
        body: 'Your seller subscription grace period has ended. Resubscribe to continue selling.',
        href: '/profile',
      });
    }
  }

  return {
    data: {
      processedAt: now.toISOString(),
      expiredFromActive: expiredFromActive.length,
      gracedFromActive: gracedFromActive.length,
      expiredFromGrace: expiredFromGrace.length,
    },
  };
});
