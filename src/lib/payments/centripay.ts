import { env } from '../env';
import type { PaymentProvider, ChargeRequest, ChargeResult, PayoutRequest } from './types';
import { toMajorUnits, msisdn } from './types';

/**
 * CentriPay — free/fallback aggregator adapter. Used automatically when no
 * MTN/Airtel keys are configured (a way to transact before you've paid for the
 * direct carrier APIs). Activates once CENTRIPAY_BASE_URL + CENTRIPAY_API_KEY
 * are set.
 *
 * ⚠️ This follows the COMMON mobile-money-aggregator shape (Bearer key + a
 * collect endpoint that returns a reference). Confirm the exact endpoint paths
 * and field names against CentriPay's own API docs and tweak the two fetches
 * below — nothing else in the app needs to change.
 */

const BASE = () => env.CENTRIPAY_BASE_URL.replace(/\/$/, '');

function authHeaders() {
  return {
    Authorization: `Bearer ${env.CENTRIPAY_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function createCentriPayProvider(): PaymentProvider {
  const configured = Boolean(env.CENTRIPAY_BASE_URL && env.CENTRIPAY_API_KEY);

  return {
    name: 'CENTRIPAY',
    configured,

    async charge(req: ChargeRequest): Promise<ChargeResult> {
      if (!configured) {
        return { status: 'PENDING', providerRef: `CENTRI-${req.reference}`, message: 'CentriPay not configured.' };
      }
      try {
        const res = await fetch(`${BASE()}/collections`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            amount: toMajorUnits(req.amount),
            currency: req.currency,
            msisdn: msisdn(req.phone),
            reference: req.reference,
            description: req.description ?? 'Zenova payment',
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { reference?: string; status?: string };
        if (res.ok) return { status: 'PENDING', providerRef: json.reference ?? req.reference };
        return { status: 'FAILED', providerRef: req.reference, message: `CentriPay ${res.status}` };
      } catch (err) {
        return { status: 'FAILED', providerRef: req.reference, message: err instanceof Error ? err.message : 'CentriPay error' };
      }
    },

    async payout(req: PayoutRequest): Promise<ChargeResult> {
      if (!configured) {
        return { status: 'PENDING', providerRef: `CENTRI-PAYOUT-${req.reference}`, message: 'CentriPay not configured.' };
      }
      try {
        const res = await fetch(`${BASE()}/payouts`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            amount: toMajorUnits(req.amount),
            currency: req.currency,
            // Aggregators usually accept either a subscriber MSISDN or a till/merchant code.
            [req.target.kind === 'momo_code' ? 'merchant_code' : 'msisdn']:
              req.target.kind === 'momo_code' ? req.target.value : msisdn(req.target.value),
            reference: req.reference,
            description: req.description ?? 'Zenova payout',
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { reference?: string };
        if (res.ok) return { status: 'PENDING', providerRef: json.reference ?? req.reference };
        return { status: 'FAILED', providerRef: req.reference, message: `CentriPay ${res.status}` };
      } catch (err) {
        return { status: 'FAILED', providerRef: req.reference, message: err instanceof Error ? err.message : 'CentriPay error' };
      }
    },

    async status(providerRef: string): Promise<ChargeResult['status']> {
      if (!configured) return 'PENDING';
      try {
        const res = await fetch(`${BASE()}/transactions/${providerRef}`, { headers: authHeaders() });
        if (!res.ok) return 'PENDING';
        const json = (await res.json()) as { status?: string };
        const s = (json.status ?? '').toUpperCase();
        return s === 'SUCCESS' || s === 'SUCCESSFUL' || s === 'COMPLETED'
          ? 'SUCCESS'
          : s === 'FAILED' || s === 'DECLINED'
            ? 'FAILED'
            : 'PENDING';
      } catch {
        return 'PENDING';
      }
    },
  };
}
