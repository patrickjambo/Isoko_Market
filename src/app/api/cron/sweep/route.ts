import type { NextRequest } from 'next/server';
import { route, jsonOk, jsonError } from '@/lib/api';
import { env } from '@/lib/env';
import { sweepStaleListings } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

/**
 * Stale-listing housekeeping (Section 5). Scheduled daily by Vercel Cron, which
 * calls it with GET and an `Authorization: Bearer $CRON_SECRET` header. POST is
 * also accepted for manual/other schedulers. Not user-facing.
 */
async function handle(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET || env.AUTH_SECRET;
  const provided =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.headers.get('x-cron-secret');
  if (provided !== secret) {
    return jsonError('UNAUTHORIZED', 'Invalid cron secret.');
  }
  const result = await sweepStaleListings();
  return jsonOk(result);
}

export const GET = route(handle);
export const POST = route(handle);
