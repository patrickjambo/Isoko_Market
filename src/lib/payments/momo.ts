import type { PaymentProvider, ChargeRequest, ChargeResult } from './types';

/**
 * ⚠️ DORMANT for buyer↔seller payments (manual-P2P migration): those now happen
 * off-platform (buyer pays the seller's MoMo/Airtel number directly, both
 * confirm in-app — see src/lib/orders.ts). This adapter, the PaymentProvider
 * abstraction, and /api/payments/webhook (with its verified auth + idempotency
 * fix) are intentionally RETAINED, not deleted: platform fees still route
 * through the (mock) provider, and a real merchant-API integration or a future
 * escrow model can reactivate this path via PAYMENTS_PROVIDER=mtn_momo.
 *
 * MTN Mobile Money (Collections API) adapter — production scaffold.
 * Fill in the sandbox/live base URL and credentials from env, then flip
 * PAYMENTS_PROVIDER=mtn_momo. Until credentials exist it falls back to PENDING
 * so callers can still exercise the webhook-driven flow.
 */
export function createMtnProvider(): PaymentProvider {
  const subKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
  const apiUser = process.env.MTN_MOMO_API_USER;
  const apiKey = process.env.MTN_MOMO_API_KEY;
  const configured = Boolean(subKey && apiUser && apiKey);

  return {
    name: 'MTN_MOMO',
    async charge(req: ChargeRequest): Promise<ChargeResult> {
      if (!configured) {
        return {
          status: 'PENDING',
          providerRef: `MOMO-${req.reference}`,
          message: 'MTN MoMo not configured; awaiting credentials.',
        };
      }
      // TODO: exchange credentials for a bearer token, then POST requesttopay.
      // const token = await getAccessToken();
      // await fetch(`${BASE}/collection/v1_0/requesttopay`, { ... });
      return { status: 'PENDING', providerRef: `MOMO-${req.reference}` };
    },
    async status() {
      return 'PENDING';
    },
  };
}
