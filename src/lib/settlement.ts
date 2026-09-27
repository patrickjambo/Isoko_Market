import 'server-only';
import { prisma } from './prisma';
import { getPlatformSettings, computeCommission } from './commission';
import { startPayout, type PayoutTarget } from './payments';
import { notify } from './notifications';
import { emitAdmin } from './admin-realtime';

const rwf = (minor: number) => Math.round(minor / 100).toLocaleString();

export type SettleResult =
  | { settled: false; reason: 'not_found' | 'already_settled' | 'no_payout_target' }
  | { settled: true; fee: number; net: number };

/**
 * Option-A escrow settlement: once the buyer's money has been collected to the
 * platform, split it — pay the seller their NET, send the platform commission
 * to the configured destination, and stamp the order. Commission is computed at
 * this moment (respecting the free period / launch date) and snapshotted onto
 * the order so a later rate change never rewrites it. Idempotent: an order
 * that's already COMPLETED is skipped.
 *
 * Payouts go through the same provider registry as collections, so a seller's
 * phone (disbursement) or merchant MoMo code is handled automatically.
 */
export async function settleOrder(orderId: string): Promise<SettleResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      amount: true,
      status: true,
      buyerId: true,
      sellerId: true,
      seller: { select: { paymentNumber: true, payoutKind: true, createdAt: true } },
      listing: { select: { title: true } },
    },
  });
  if (!order) return { settled: false, reason: 'not_found' };
  if (order.status === 'COMPLETED') return { settled: false, reason: 'already_settled' };
  if (!order.seller.paymentNumber) return { settled: false, reason: 'no_payout_target' };

  const settings = await getPlatformSettings();
  const { fee } = computeCommission({
    amount: order.amount,
    sellerCreatedAt: order.seller.createdAt,
    settings,
  });
  const net = order.amount - fee;

  // Pay the seller their net to their phone or merchant code.
  const sellerTarget: PayoutTarget =
    order.seller.payoutKind === 'MOMO_CODE'
      ? { kind: 'momo_code', value: order.seller.paymentNumber }
      : { kind: 'phone', value: order.seller.paymentNumber };
  await startPayout({
    amount: net,
    target: sellerTarget,
    reference: `order-${order.id}-seller`,
    routeByPhone: order.seller.payoutKind === 'PHONE' ? order.seller.paymentNumber : undefined,
    description: `Zenova: ${order.listing.title}`,
  });

  // Send the commission to the platform's destination (if any is due + set).
  if (fee > 0 && settings.payoutValue) {
    const platformTarget: PayoutTarget =
      settings.payoutKind === 'MOMO_CODE'
        ? { kind: 'momo_code', value: settings.payoutValue }
        : { kind: 'phone', value: settings.payoutValue };
    await startPayout({
      amount: fee,
      target: platformTarget,
      reference: `order-${order.id}-fee`,
      routeByPhone: settings.payoutKind === 'PHONE' ? settings.payoutValue : undefined,
      description: 'Zenova commission',
    });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'COMPLETED', commissionAmount: fee },
  });

  await Promise.all([
    notify({
      userId: order.sellerId,
      type: 'PAYMENT',
      title: 'Payment settled',
      body:
        fee > 0
          ? `You received RWF ${rwf(net)} for "${order.listing.title}" (RWF ${rwf(fee)} platform commission).`
          : `You received RWF ${rwf(net)} for "${order.listing.title}".`,
      href: `/orders/${order.id}`,
    }),
    notify({
      userId: order.buyerId,
      type: 'PAYMENT',
      title: 'Order complete',
      body: `Your payment for "${order.listing.title}" is complete.`,
      href: `/orders/${order.id}`,
    }),
  ]);
  await emitAdmin('transaction.completed', `Order settled — commission RWF ${rwf(fee)}`);

  return { settled: true, fee, net };
}
