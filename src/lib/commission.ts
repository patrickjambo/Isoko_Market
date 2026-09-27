import 'server-only';
import type { PlatformSettings } from '@prisma/client';
import { prisma } from './prisma';

const SINGLETON_ID = 'singleton';

/**
 * The platform settings row (commission config). Created on first read so the
 * admin dashboard always has something to edit. Read directly (no cache) so an
 * admin's change takes effect immediately for the next transaction.
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  return prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
}

export type CommissionReason = 'DISABLED' | 'BEFORE_LAUNCH' | 'FREE_PERIOD' | 'CHARGED';
export type CommissionResult = { fee: number; applies: boolean; reason: CommissionReason };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Commission (in RWF minor units) charged on an order of `amount`, given the
 * seller's signup date. Pure + deterministic so it's unit-testable. Gates, in
 * order: master switch off → 0; before the platform charging-start date → 0;
 * seller still inside their free period → 0; otherwise percent/fixed with an
 * optional floor/cap, never exceeding the order amount.
 */
export function computeCommission(params: {
  amount: number;
  sellerCreatedAt: Date;
  settings: Pick<
    PlatformSettings,
    | 'commissionEnabled'
    | 'commissionType'
    | 'commissionPercent'
    | 'commissionFixed'
    | 'commissionMin'
    | 'commissionMax'
    | 'chargingStartsAt'
    | 'freePeriodDays'
  >;
  now?: Date;
}): CommissionResult {
  const { amount, sellerCreatedAt, settings } = params;
  const now = params.now ?? new Date();

  if (!settings.commissionEnabled) return { fee: 0, applies: false, reason: 'DISABLED' };
  if (settings.chargingStartsAt && now < settings.chargingStartsAt) {
    return { fee: 0, applies: false, reason: 'BEFORE_LAUNCH' };
  }
  if (settings.freePeriodDays > 0) {
    const freeUntil = new Date(sellerCreatedAt.getTime() + settings.freePeriodDays * DAY_MS);
    if (now < freeUntil) return { fee: 0, applies: false, reason: 'FREE_PERIOD' };
  }

  let fee =
    settings.commissionType === 'PERCENT'
      ? Math.round(amount * (settings.commissionPercent / 100))
      : settings.commissionFixed;
  if (settings.commissionMin > 0) fee = Math.max(fee, settings.commissionMin);
  if (settings.commissionMax > 0) fee = Math.min(fee, settings.commissionMax);
  fee = Math.max(0, Math.min(fee, amount)); // never take more than the order

  return { fee, applies: fee > 0, reason: 'CHARGED' };
}

/** Convenience: current commission for an amount + seller, using live settings. */
export async function quoteCommission(amount: number, sellerCreatedAt: Date): Promise<CommissionResult> {
  return computeCommission({ amount, sellerCreatedAt, settings: await getPlatformSettings() });
}
