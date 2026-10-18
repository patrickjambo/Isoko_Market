import { NextResponse } from 'next/server';
import { getFeatureFlags } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

/**
 * GET /api/feature-flags — Public endpoint returning current platform feature flags.
 * Used for client-side state synchronization, fallbacks, and offline resume.
 */
export async function GET() {
  const flags = await getFeatureFlags();
  return NextResponse.json(
    { data: flags },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
