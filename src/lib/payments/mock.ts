import type { PaymentProvider, ChargeRequest, ChargeResult, PayoutRequest } from './types';

/**
 * Deterministic mock provider for local dev and tests. Succeeds unless the
 * amount ends in "13" (RWF 0.13) which simulates a decline — handy for testing
 * the failure path without hitting a real gateway.
 */
export const mockProvider: PaymentProvider = {
  name: 'MOCK',
  configured: true, // always usable — it's the dev/no-keys default
  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const declined = req.amount % 100 === 13;
    return {
      status: declined ? 'FAILED' : 'SUCCESS',
      providerRef: `MOCK-${req.reference}`,
      message: declined ? 'Simulated decline' : 'Simulated success',
    };
  },
  async payout(req: PayoutRequest): Promise<ChargeResult> {
    return { status: 'SUCCESS', providerRef: `MOCK-PAYOUT-${req.reference}`, message: 'Simulated payout' };
  },
  async status() {
    return 'SUCCESS';
  },
};
