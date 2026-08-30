import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { paymentSchema } from '@/lib/validators/misc';
import { francsToMinor } from '@/lib/utils';
import { startPayment } from '@/lib/payments';
import { notify } from '@/lib/notifications';
import { emitAdmin } from '@/lib/admin-realtime';

const FEATURE_DAYS = 7;

/**
 * POST /api/payments — initiate a Mobile Money charge for a premium feature
 * (Section 6.4). On success we apply the entitlement (wallet top-up, featured
 * listing, etc.). Money math lives in the payments service, not here.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = paymentSchema.parse(await req.json().catch(() => ({})));
  const amount = francsToMinor(input.amount);

  const { transaction, result } = await startPayment({
    userId: user.id,
    phone: user.phone ?? '', // DORMANT platform-fee path (mock provider); real number wired later
    type: input.type,
    amount,
    metadata: input.metadata,
  });

  if (result.status === 'SUCCESS') {
    if (input.type === 'TOPUP') {
      await prisma.user.update({
        where: { id: user.id },
        data: { walletBalance: { increment: amount } },
      });
    }
    if (input.type === 'FEATURED_LISTING' && input.metadata?.listingId) {
      const listingId = input.metadata.listingId;
      const owned = await prisma.listing.findFirst({
        where: { id: listingId, sellerId: user.id },
        select: { id: true },
      });
      if (owned) {
        await prisma.listing.update({
          where: { id: listingId },
          data: {
            isFeatured: true,
            featuredUntil: new Date(Date.now() + FEATURE_DAYS * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    await notify({
      userId: user.id,
      type: 'PAYMENT',
      title: 'Payment successful',
      body: `${input.type.replace('_', ' ').toLowerCase()} — RWF ${input.amount.toLocaleString()}`,
    });

    // admin:transaction.completed — live revenue on the dashboard.
    await emitAdmin(
      'transaction.completed',
      `${input.type.replace('_', ' ').toLowerCase()} — RWF ${input.amount.toLocaleString()}`
    );
  }

  return jsonOk({ transaction: { id: transaction.id, status: result.status }, result });
});
