import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlatformSettings } from '@/lib/commission';
import { startPayment } from '@/lib/payments';
import { notify } from '@/lib/notifications';
import { emitAdmin } from '@/lib/admin-realtime';

const subscribeSchema = z.object({
  plan: z.enum(['MONTHLY', 'ANNUAL']),
  phone: z.string().min(1, 'Phone number is required'),
});

const DAYS_MONTHLY = 30;
const DAYS_ANNUAL = 365;

/**
 * POST /api/seller/subscription — seller subscribes (monthly or annual).
 * Initiates a MoMo charge from the seller's phone. On SUCCESS, activates
 * their subscription and sets the expiry date.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = subscribeSchema.parse(await req.json().catch(() => ({})));

  const settings = await getPlatformSettings();
  if (!settings.subscriptionEnabled) {
    throw new ApiError('FORBIDDEN', 'Seller subscriptions are not currently enabled.');
  }

  const amount =
    input.plan === 'MONTHLY'
      ? settings.subscriptionMonthlyPrice
      : settings.subscriptionAnnualPrice;

  const { transaction, result } = await startPayment({
    userId: user.id,
    phone: input.phone,
    type: 'SUBSCRIPTION',
    amount,
    metadata: {
      plan: input.plan,
      subscriptionMomoNumber: settings.subscriptionMomoNumber,
      subscriptionMomoKind: settings.subscriptionMomoKind,
    },
  });

  if (result.status === 'SUCCESS') {
    const daysToAdd = input.plan === 'MONTHLY' ? DAYS_MONTHLY : DAYS_ANNUAL;
    const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: input.plan,
        subscriptionExpiresAt: expiresAt,
      },
    });

    await notify({
      userId: user.id,
      type: 'PAYMENT',
      title: 'Subscription activated',
      body: `Your ${input.plan.toLowerCase()} subscription is now active until ${expiresAt.toLocaleDateString()}.`,
    });

    await emitAdmin(
      'transaction.completed',
      `Seller subscription (${input.plan}) — RWF ${amount.toLocaleString()}`
    );
  }

  const subscriptionExpiresAt =
    result.status === 'SUCCESS'
      ? new Date(
          Date.now() +
            (input.plan === 'MONTHLY' ? DAYS_MONTHLY : DAYS_ANNUAL) * 24 * 60 * 60 * 1000
        ).toISOString()
      : null;

  return jsonOk({ transaction: { id: transaction.id, status: result.status }, result, subscriptionExpiresAt });
});

/**
 * GET /api/seller/subscription — returns seller's current subscription status.
 */
export const GET = route(async () => {
  const user = await requireUser();

  const seller = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      subscriptionStatus: true,
      subscriptionPlan: true,
      subscriptionExpiresAt: true,
    },
  });

  const settings = await getPlatformSettings();

  return jsonOk({
    subscriptionEnabled: settings.subscriptionEnabled,
    subscriptionStatus: seller?.subscriptionStatus ?? 'NONE',
    subscriptionPlan: seller?.subscriptionPlan ?? null,
    subscriptionExpiresAt: seller?.subscriptionExpiresAt?.toISOString() ?? null,
    monthlyPrice: settings.subscriptionMonthlyPrice,
    annualPrice: settings.subscriptionAnnualPrice,
  });
});
