import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/dismissed — called by the service worker's notificationclose
 * handler as a best-effort engagement signal.  We accept and discard it so the
 * SW never gets a 404 that could surface as an error in browser DevTools.
 * Extend this later to record dismiss analytics in a lightweight event table.
 */
export async function POST() {
  return NextResponse.json({ ok: true });
}
