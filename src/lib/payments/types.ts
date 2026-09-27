/**
 * PaymentProvider interface (Section 6.4). Business logic never talks to MTN or
 * Airtel directly — it goes through this interface, so a new provider, an
 * aggregator, or an escrow model can be added without rewriting anything above
 * it. Adapters read their own credentials from `env`; the registry (index.ts)
 * activates whichever are configured — no code changes to go live.
 */
export type ChargeRequest = {
  /** Amount in RWF minor units (centimes). */
  amount: number;
  currency: 'RWF';
  /** Payer phone in E.164 (+2507XXXXXXXX). */
  phone: string;
  /** Idempotency / correlation reference (our Transaction id). */
  reference: string;
  description?: string;
};

/**
 * Where a seller gets paid. Sellers give EITHER a mobile-money phone number OR a
 * merchant "MoMo code" (USSD short code) — the adapter routes to the right API
 * (disbursement to a MSISDN vs. a merchant transfer) based on `kind`.
 */
export type PayoutTarget =
  | { kind: 'phone'; value: string } // E.164 MSISDN
  | { kind: 'momo_code'; value: string }; // merchant/till code

export type PayoutRequest = {
  amount: number; // RWF minor units
  currency: 'RWF';
  target: PayoutTarget;
  reference: string;
  description?: string;
};

export type ChargeResult = {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  providerRef: string;
  message?: string;
};

export interface PaymentProvider {
  readonly name: 'MTN_MOMO' | 'AIRTEL_MONEY' | 'CENTRIPAY' | 'MOCK';
  /** True once real credentials are present (drives auto-selection). */
  readonly configured: boolean;
  /** Request-to-pay (collect from the buyer). Async: final status via webhook. */
  charge(req: ChargeRequest): Promise<ChargeResult>;
  /** Disburse to a seller's phone or merchant code. */
  payout(req: PayoutRequest): Promise<ChargeResult>;
  /** Poll a transaction's status by provider reference. */
  status(providerRef: string): Promise<ChargeResult['status']>;
}

/** RWF is stored in minor units; MoMo/Airtel APIs expect whole RWF. */
export function toMajorUnits(minor: number): number {
  return Math.round(minor / 100);
}

/** Strip a phone to the local MSISDN the mobile-money APIs expect (2507XXXXXXXX). */
export function msisdn(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('250') ? digits : digits.replace(/^0/, '250');
}
