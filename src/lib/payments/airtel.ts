import { env } from '../env';
import type { PaymentProvider, ChargeRequest, ChargeResult, PayoutRequest } from './types';
import { toMajorUnits, msisdn } from './types';

/**
 * Airtel Money — Open API adapter (Collections + Disbursements).
 *
 * Activates automatically once AIRTEL_CLIENT_ID / AIRTEL_CLIENT_SECRET are set.
 * Point AIRTEL_BASE_URL at the production host + PAYMENTS_ENV=production to go
 * live. Collections prompt the payer for their PIN (async → PENDING, resolved
 * via status()/webhook, keyed by our transaction id).
 */

const BASE = () => env.AIRTEL_BASE_URL.replace(/\/$/, '');

async function accessToken(): Promise<string> {
  const res = await fetch(`${BASE()}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify({
      client_id: env.AIRTEL_CLIENT_ID,
      client_secret: env.AIRTEL_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`Airtel token failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Airtel token missing');
  return json.access_token;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Country': env.AIRTEL_COUNTRY,
    'X-Currency': env.AIRTEL_CURRENCY,
    'Content-Type': 'application/json',
    Accept: '*/*',
  };
}

export function createAirtelProvider(): PaymentProvider {
  const configured = Boolean(env.AIRTEL_CLIENT_ID && env.AIRTEL_CLIENT_SECRET);

  return {
    name: 'AIRTEL_MONEY',
    configured,

    async charge(req: ChargeRequest): Promise<ChargeResult> {
      if (!configured) {
        return { status: 'PENDING', providerRef: `AIRTEL-${req.reference}`, message: 'Airtel not configured.' };
      }
      try {
        const token = await accessToken();
        const res = await fetch(`${BASE()}/merchant/v1/payments/`, {
          method: 'POST',
          headers: headers(token),
          body: JSON.stringify({
            reference: req.reference,
            subscriber: { country: env.AIRTEL_COUNTRY, currency: env.AIRTEL_CURRENCY, msisdn: msisdn(req.phone) },
            transaction: {
              amount: toMajorUnits(req.amount),
              country: env.AIRTEL_COUNTRY,
              currency: env.AIRTEL_CURRENCY,
              id: req.reference,
            },
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          status?: { success?: boolean; message?: string };
        };
        if (res.ok && json.status?.success !== false) {
          return { status: 'PENDING', providerRef: req.reference };
        }
        return { status: 'FAILED', providerRef: req.reference, message: json.status?.message ?? `Airtel ${res.status}` };
      } catch (err) {
        return { status: 'FAILED', providerRef: req.reference, message: err instanceof Error ? err.message : 'Airtel error' };
      }
    },

    async payout(req: PayoutRequest): Promise<ChargeResult> {
      if (req.target.kind === 'momo_code') {
        return { status: 'PENDING', providerRef: `AIRTEL-PAYOUT-${req.reference}`, message: 'Merchant-code payout: settle manually.' };
      }
      if (!configured || !env.AIRTEL_PIN) {
        return { status: 'PENDING', providerRef: `AIRTEL-PAYOUT-${req.reference}`, message: 'Airtel disbursement not configured.' };
      }
      try {
        const token = await accessToken();
        const res = await fetch(`${BASE()}/standard/v1/disbursements/`, {
          method: 'POST',
          headers: headers(token),
          body: JSON.stringify({
            payee: { msisdn: msisdn(req.target.value) },
            reference: req.reference,
            pin: env.AIRTEL_PIN,
            transaction: { amount: toMajorUnits(req.amount), id: req.reference },
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { status?: { success?: boolean; message?: string } };
        if (res.ok && json.status?.success !== false) return { status: 'PENDING', providerRef: req.reference };
        return { status: 'FAILED', providerRef: req.reference, message: json.status?.message ?? `Airtel ${res.status}` };
      } catch (err) {
        return { status: 'FAILED', providerRef: req.reference, message: err instanceof Error ? err.message : 'Airtel error' };
      }
    },

    async status(providerRef: string): Promise<ChargeResult['status']> {
      if (!configured) return 'PENDING';
      try {
        const token = await accessToken();
        const res = await fetch(`${BASE()}/standard/v1/payments/${providerRef}`, { headers: headers(token) });
        if (!res.ok) return 'PENDING';
        const json = (await res.json()) as { data?: { transaction?: { status?: string } } };
        const s = (json.data?.transaction?.status ?? '').toUpperCase();
        // Airtel: TS=Transaction Success, TF=Failed, TA/TIP=in progress.
        return s === 'TS' || s === 'SUCCESS'
          ? 'SUCCESS'
          : s === 'TF' || s === 'FAILED'
            ? 'FAILED'
            : 'PENDING';
      } catch {
        return 'PENDING';
      }
    },
  };
}
