import type { NextRequest } from 'next/server';
import { route, jsonOk, jsonError } from '@/lib/api';
import { env } from '@/lib/env';
import { reconcileWallets } from '@/lib/wallet-reconcile';

export const dynamic = 'force-dynamic';

/**
 * Wallet-balance reconciliation (from the Rule 1 audit — `walletBalance` is a
 * money aggregate worth watching). Scheduled like the stale-listing sweep:
 * `Authorization: Bearer $CRON_SECRET`. DETECT + LOG only — never auto-corrects.
 * Not user-facing. Returns the mismatch report so an operator/scheduler log
 * captures it.
 */
async function handle(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET || env.AUTH_SECRET;
  const provided =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.headers.get('x-cron-secret');
  if (provided !== secret) {
    return jsonError('UNAUTHORIZED', 'Invalid cron secret.');
  }
  return jsonOk(await reconcileWallets());
}

export const GET = route(handle);
export const POST = route(handle);
