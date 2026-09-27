import { randomUUID } from 'node:crypto';
import { env } from '../env';
import type { PaymentProvider, ChargeRequest, ChargeResult, PayoutRequest } from './types';
import { toMajorUnits, msisdn } from './types';

/**
 * MTN Mobile Money — Open API adapter (Collections + Disbursements).
 *
 * Activates automatically once MTN_MOMO_SUBSCRIPTION_KEY / _API_USER / _API_KEY
 * are set (see env.ts). Collections charge the buyer (request-to-pay);
 * Disbursements pay the seller's phone. Set PAYMENTS_ENV=production +
 * MTN_MOMO_TARGET_ENV=mtnrwanda + MTN_MOMO_CURRENCY=RWF to go live.
 *
 * The request-to-pay is asynchronous: we return PENDING and the final status
 * arrives at /api/payments/webhook (or via status() polling), keyed by the
 * X-Reference-Id we generate here (stored as the transaction's momoRef).
 */

const BASE = () => env.MTN_MOMO_BASE_URL.replace(/\/$/, '');

async function accessToken(product: 'collection' | 'disbursement'): Promise<string> {
  const user = product === 'collection' ? env.MTN_MOMO_API_USER : env.MTN_DISBURSE_API_USER;
  const key = product === 'collection' ? env.MTN_MOMO_API_KEY : env.MTN_DISBURSE_API_KEY;
  const subKey =
    product === 'collection' ? env.MTN_MOMO_SUBSCRIPTION_KEY : env.MTN_DISBURSE_SUBSCRIPTION_KEY;
  const basic = Buffer.from(`${user}:${key}`).toString('base64');
  const res = await fetch(`${BASE()}/${product}/token/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Ocp-Apim-Subscription-Key': subKey },
  });
  if (!res.ok) throw new Error(`MTN ${product} token failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('MTN token missing');
  return json.access_token;
}

export function createMtnProvider(): PaymentProvider {
  const configured = Boolean(
    env.MTN_MOMO_SUBSCRIPTION_KEY && env.MTN_MOMO_API_USER && env.MTN_MOMO_API_KEY
  );
  const disburseConfigured = Boolean(
    env.MTN_DISBURSE_SUBSCRIPTION_KEY && env.MTN_DISBURSE_API_USER && env.MTN_DISBURSE_API_KEY
  );

  return {
    name: 'MTN_MOMO',
    configured,

    async charge(req: ChargeRequest): Promise<ChargeResult> {
      if (!configured) {
        return { status: 'PENDING', providerRef: `MOMO-${req.reference}`, message: 'MTN MoMo not configured.' };
      }
      const refId = randomUUID(); // X-Reference-Id — also our provider ref for status/webhook
      try {
        const token = await accessToken('collection');
        const res = await fetch(`${BASE()}/collection/v1_0/requesttopay`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Reference-Id': refId,
            'X-Target-Environment': env.MTN_MOMO_TARGET_ENV,
            'Ocp-Apim-Subscription-Key': env.MTN_MOMO_SUBSCRIPTION_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: String(toMajorUnits(req.amount)),
            currency: env.MTN_MOMO_CURRENCY,
            externalId: req.reference,
            payer: { partyIdType: 'MSISDN', partyId: msisdn(req.phone) },
            payerMessage: req.description ?? 'Zenova payment',
            payeeNote: req.description ?? 'Zenova',
          }),
        });
        // 202 Accepted → the prompt was sent; payment is now pending the payer's PIN.
        if (res.status === 202) return { status: 'PENDING', providerRef: refId };
        const detail = await res.text().catch(() => '');
        return { status: 'FAILED', providerRef: refId, message: `MTN requesttopay ${res.status} ${detail}`.trim() };
      } catch (err) {
        return { status: 'FAILED', providerRef: refId, message: err instanceof Error ? err.message : 'MTN error' };
      }
    },

    async payout(req: PayoutRequest): Promise<ChargeResult> {
      // MTN disbursement targets a MSISDN. A merchant "MoMo code" isn't a
      // disbursement destination, so that leg is settled manually for now.
      if (req.target.kind === 'momo_code') {
        return { status: 'PENDING', providerRef: `MOMO-PAYOUT-${req.reference}`, message: 'Merchant-code payout: settle manually.' };
      }
      if (!disburseConfigured) {
        return { status: 'PENDING', providerRef: `MOMO-PAYOUT-${req.reference}`, message: 'MTN disbursement not configured.' };
      }
      const refId = randomUUID();
      try {
        const token = await accessToken('disbursement');
        const res = await fetch(`${BASE()}/disbursement/v1_0/transfer`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Reference-Id': refId,
            'X-Target-Environment': env.MTN_MOMO_TARGET_ENV,
            'Ocp-Apim-Subscription-Key': env.MTN_DISBURSE_SUBSCRIPTION_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: String(toMajorUnits(req.amount)),
            currency: env.MTN_MOMO_CURRENCY,
            externalId: req.reference,
            payee: { partyIdType: 'MSISDN', partyId: msisdn(req.target.value) },
            payerMessage: req.description ?? 'Zenova payout',
            payeeNote: req.description ?? 'Zenova',
          }),
        });
        if (res.status === 202) return { status: 'PENDING', providerRef: refId };
        const detail = await res.text().catch(() => '');
        return { status: 'FAILED', providerRef: refId, message: `MTN transfer ${res.status} ${detail}`.trim() };
      } catch (err) {
        return { status: 'FAILED', providerRef: refId, message: err instanceof Error ? err.message : 'MTN error' };
      }
    },

    async status(providerRef: string): Promise<ChargeResult['status']> {
      if (!configured) return 'PENDING';
      try {
        const token = await accessToken('collection');
        const res = await fetch(`${BASE()}/collection/v1_0/requesttopay/${providerRef}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': env.MTN_MOMO_TARGET_ENV,
            'Ocp-Apim-Subscription-Key': env.MTN_MOMO_SUBSCRIPTION_KEY,
          },
        });
        if (!res.ok) return 'PENDING';
        const json = (await res.json()) as { status?: string };
        const s = (json.status ?? '').toUpperCase();
        return s === 'SUCCESSFUL'
          ? 'SUCCESS'
          : s === 'FAILED' || s === 'REJECTED' || s === 'TIMEOUT'
            ? 'FAILED'
            : 'PENDING';
      } catch {
        return 'PENDING';
      }
    },
  };
}
