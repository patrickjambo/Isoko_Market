import type { PaymentProvider, ChargeRequest, ChargeResult } from './types';

/**
 * MTN Mobile Money (Collections API) adapter — production scaffold.
 * Kept intentionally thin: it only implements the PaymentProvider contract.
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
