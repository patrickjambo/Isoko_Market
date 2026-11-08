import { NextResponse } from 'next/server';
import { getPlatformSettings } from '@/lib/commission';
import type { SubscriptionSettings } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * GET /api/subscription-settings — Public endpoint returning current subscription settings.
 * Used for client-side state synchronization, realtime fallback, and cross-device sync.
 */
export async function GET() {
  const s = await getPlatformSettings();
  const settings: SubscriptionSettings = {
    subscriptionEnabled: s.subscriptionEnabled,
    subscriptionMonthlyPrice: s.subscriptionMonthlyPrice,
    subscriptionAnnualPrice: s.subscriptionAnnualPrice,
    subscriptionMomoNumber: s.subscriptionMomoNumber,
    subscriptionMomoKind: s.subscriptionMomoKind,
    subscriptionRequireOnPublish: s.subscriptionRequireOnPublish,
    subscriptionAutoExpireMonths: s.subscriptionAutoExpireMonths,
    subscriptionAutoExpireListings: s.subscriptionAutoExpireListings,
  };

  return NextResponse.json(
    { data: settings },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
