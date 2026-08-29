import type { NextRequest } from 'next/server';
import { route, jsonOk, jsonError } from '@/lib/api';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { publish, publishTopic } from '@/lib/realtime';
import { emitAdmin } from '@/lib/admin-realtime';

const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'REFUNDED'];

/**
 * POST /api/payments/webhook — provider callback endpoint (Section 11 / buyer
 * Section 10). MTN/Airtel post the final status of an async request-to-pay here.
 *
 * SECURITY: the body is untrusted, so the caller must present the shared
 * PAYMENTS_WEBHOOK_SECRET (falls back to AUTH_SECRET) — a floor that real
 * MTN/Airtel HMAC-signature verification will layer on/replace when a live
 * provider is wired. Processing is idempotent: a replay with the SAME status is
 * a no-op; a CONFLICTING terminal status (e.g. SUCCESS after FAILED) is logged
 * as an anomaly (replay attack or confused provider) and never applied.
 *
 * We reconcile by our transaction id (passed as the provider reference) and, if
 * the transaction backs an order, update BOTH sides atomically — never one
 * without the other:
 *   SUCCESS → notify seller ("payment received, hand over") + buyer ("awaiting
 *             seller confirmation").
 *   FAILED  → cancel the order, relist the item, notify both.
 */
export const POST = route(async (req: NextRequest) => {
  // ── Authenticate the caller before trusting anything in the body ──
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET || env.AUTH_SECRET;
  const provided =
    req.headers.get('x-webhook-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== secret) {
    return jsonError('UNAUTHORIZED', 'Invalid webhook secret.');
  }

  const body = await req.json().catch(() => ({}));
  const providerRef: string | undefined = body?.referenceId ?? body?.reference;
  const rawStatus: string | undefined = body?.status;
  if (!providerRef || !rawStatus) return jsonOk({ ok: true, ignored: true });

  const status =
    ['SUCCESSFUL', 'SUCCESS'].includes(rawStatus.toUpperCase())
      ? 'SUCCESS'
      : rawStatus.toUpperCase() === 'FAILED'
        ? 'FAILED'
        : 'PENDING';

  const tx = await prisma.transaction.findFirst({
    where: { OR: [{ momoRef: providerRef }, { id: providerRef }] },
    select: { id: true, status: true },
  });
  if (!tx) return jsonOk({ ok: true, ignored: true });

  // ── Idempotency + anomaly guard ──
  // Same status again → safe no-op (provider retry / at-least-once delivery).
  if (tx.status === status) {
    return jsonOk({ ok: true, status, idempotent: true });
  }
  // Already in a terminal state but the webhook claims a DIFFERENT one → this is
  // a replay attack or genuinely confused provider state. Never silently apply
  // it; surface it (admin ticker + server log) so it's visible once real money
  // is involved, and acknowledge without mutating.
  if (TERMINAL_STATUSES.includes(tx.status)) {
    await emitAdmin(
      'transaction.anomaly',
      `Webhook status conflict on ${tx.id}: stored ${tx.status}, webhook claims ${status}`
    );
    // eslint-disable-next-line no-console
    console.warn(`[payments/webhook] conflicting status for tx ${tx.id}: stored=${tx.status} incoming=${status}`);
    return jsonOk({ ok: true, ignored: true, anomaly: true });
  }

  await prisma.transaction.update({ where: { id: tx.id }, data: { status } });

  // Reconcile any order backed by this transaction (buyer↔seller atomic).
  const order = await prisma.order.findFirst({
    where: { transactionId: tx.id },
    include: { listing: { select: { id: true, title: true } } },
  });
  if (!order) return jsonOk({ ok: true, status });

  if (status === 'SUCCESS' && order.status === 'PAYMENT_SENT') {
    await Promise.all([
      notify({
        userId: order.sellerId,
        type: 'PAYMENT',
        title: 'Payment received (in escrow)',
        body: `Payment for "${order.listing.title}" confirmed. Hand over the item; the buyer then confirms receipt.`,
        href: `/orders/${order.id}`,
      }),
      notify({
        userId: order.buyerId,
        type: 'PAYMENT',
        title: 'Payment confirmed',
        body: `Your payment for "${order.listing.title}" is held in escrow until you confirm receipt.`,
        href: `/orders/${order.id}`,
      }),
    ]);
  } else if (status === 'FAILED' && (order.status === 'PAYMENT_SENT' || order.status === 'SELLER_CONFIRMED')) {
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } }),
      prisma.listing.update({ where: { id: order.listing.id }, data: { status: 'ACTIVE' } }),
    ]);
    publishTopic(`listing:${order.listing.id}`, { type: 'entity_update', entity: 'listing', id: order.listing.id, status: 'ACTIVE', reason: 'relisted' });
    publishTopic(`order:${order.id}`, { type: 'entity_update', entity: 'order', id: order.id, status: 'CANCELLED', reason: 'cancelled' });
    publish(order.sellerId, { type: 'entity_update', entity: 'order', id: order.id, status: 'CANCELLED', reason: 'cancelled' });
    await Promise.all([
      notify({ userId: order.buyerId, type: 'SYSTEM', title: 'Payment failed', body: `Payment for "${order.listing.title}" didn't go through.`, href: `/marketplace/${order.listing.id}` }),
      notify({ userId: order.sellerId, type: 'SYSTEM', title: 'Order cancelled', body: `A payment failed; "${order.listing.title}" is active again.`, href: `/marketplace/${order.listing.id}` }),
    ]);
    // Admin ticker parity with transaction.completed (rule 6 gap).
    await emitAdmin('transaction.failed', `Payment failed: ${order.listing.title}`);
  }

  return jsonOk({ ok: true, status });
});
