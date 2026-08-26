/**
 * PaymentProvider interface (Section 6.4). Business logic never talks to MTN or
 * Airtel directly — it goes through this interface, so a new provider or an
 * escrow model can be added without rewriting anything above it.
 */
export type ChargeRequest = {
  /** Amount in RWF minor units (centimes). */
  amount: number;
  currency: 'RWF';
  /** Payer phone in E.164 (+2507XXXXXXXX). */
  phone: string;
  /** Idempotency / correlation reference. */
  reference: string;
  description?: string;
};

export type ChargeResult = {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  providerRef: string;
  message?: string;
};

export interface PaymentProvider {
  readonly name: 'MTN_MOMO' | 'AIRTEL_MONEY' | 'MOCK';
  /** Request-to-pay. Returns immediately; final status may arrive via webhook. */
  charge(req: ChargeRequest): Promise<ChargeResult>;
  /** Poll a transaction's status by provider reference. */
  status(providerRef: string): Promise<ChargeResult['status']>;
}
