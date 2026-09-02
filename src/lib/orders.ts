import 'server-only';
import type { OrderStatus } from '@prisma/client';
import { prisma } from './prisma';
import { ApiError } from './api';
import { notify } from './notifications';
import { publishTopic } from './realtime';
import { emitAdmin } from './admin-realtime';

const rwf = (minor: number) => Math.round(minor / 100).toLocaleString();

/**
 * Create an order = the single source of truth for a deal (Section 10). This is
 * a MANUAL peer-to-peer payment flow: no money moves through the platform — the
 * buyer will send it directly to the seller's MoMo/Airtel number and both sides
 * confirm in-app. In one transaction we snapshot the seller's payout number (so
 * a later profile change never rewrites history), create the Order in
 * PENDING_PAYMENT, and reserve the listing (mark SOLD). Then notify both sides.
 *
 * The seller MUST have a payout number set — mirrors "verification unlocks
 * reach": a seller can list without it, but can't be paid through the order flow.
 */
export async function createOrder(params: {
  buyerId: string;
  buyerName: string;
  listingId: string;
  deliveryMethod?: string;
}) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.listingId },
    select: {
      id: true,
      sellerId: true,
      title: true,
      price: true,
      status: true,
      seller: { select: { paymentNumber: true, paymentProvider: true } },
    },
  });
  if (!listing || listing.status === 'REMOVED') throw new ApiError('NOT_FOUND', 'Listing not found.');
  if (listing.sellerId === params.buyerId) throw new ApiError('BAD_REQUEST', 'You cannot buy your own listing.');
  if (listing.status !== 'ACTIVE') throw new ApiError('CONFLICT', 'This item is no longer available.');

  // A payout number is NOT required to place an order. The buyer signals intent,
  // the seller is notified to add their MoMo/Airtel number, and the buyer pays
  // once it's shared — so "Buy" is always clickable and the seller always learns
  // that someone wants their item.
  const payoutNumber = listing.seller.paymentNumber ?? null;
  const provider = listing.seller.paymentProvider ?? null;
  const hasPayout = Boolean(payoutNumber);

  // Reserve the listing + create the order atomically, snapshotting the payout number.
  const [, order] = await prisma.$transaction([
    prisma.listing.update({ where: { id: listing.id }, data: { status: 'SOLD' } }),
    prisma.order.create({
      data: {
        listingId: listing.id,
        buyerId: params.buyerId,
        sellerId: listing.sellerId,
        amount: listing.price,
        status: 'PENDING_PAYMENT',
        paymentMethod: provider === 'airtel_money' ? 'manual_airtel' : 'manual_momo',
        sellerPayoutNumber: payoutNumber, // may be null until the seller adds one
        deliveryMethod: params.deliveryMethod,
      },
      select: { id: true },
    }),
  ]);

  // Propagate to anyone viewing the listing (Section 10).
  publishTopic(`listing:${listing.id}`, { type: 'entity_update', entity: 'listing', id: listing.id, status: 'SOLD', reason: 'sold' });

  await Promise.all([
    notify({
      userId: listing.sellerId,
      type: 'PAYMENT',
      title: hasPayout ? 'New order' : 'Someone wants to buy!',
      body: hasPayout
        ? `${params.buyerName} wants "${listing.title}" (RWF ${rwf(listing.price)}). They'll send the money to your number, then you confirm you received it.`
        : `${params.buyerName} wants to buy "${listing.title}" (RWF ${rwf(listing.price)}). Add your MoMo/Airtel number in Settings so they can pay you.`,
      href: `/orders/${order.id}`,
      payload: { orderId: order.id },
    }),
    notify({
      userId: params.buyerId,
      type: 'PAYMENT',
      title: 'Order placed',
      body: hasPayout
        ? `Send RWF ${rwf(listing.price)} to the seller's ${provider === 'airtel_money' ? 'Airtel Money' : 'MoMo'} number, then mark it as paid.`
        : `We've told the seller you want "${listing.title}". They'll share their payment number shortly — we'll notify you.`,
      href: `/orders/${order.id}`,
      payload: { orderId: order.id },
    }),
  ]);
  await emitAdmin('order.created', `Manual order — RWF ${rwf(listing.price)}`);

  return order;
}

export async function getOrdersForUser(userId: string) {
  const orders = await prisma.order.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: { select: { id: true, title: true, images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } } } },
      buyer: { select: { id: true, fullName: true } },
      seller: { select: { id: true, fullName: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    status: o.status,
    amount: o.amount,
    role: o.buyerId === userId ? ('buyer' as const) : ('seller' as const),
    listing: o.listing,
    counterpart: o.buyerId === userId ? o.seller : o.buyer,
    reviewed: o.reviewed,
    createdAt: o.createdAt.toISOString(),
  }));
}

export const ORDER_FLOW: OrderStatus[] = [
  'PENDING_PAYMENT',
  'BUYER_MARKED_PAID',
  'SELLER_CONFIRMED',
  'COMPLETED',
];

/**
 * Seller sales summary for the dashboard: total earned (from completed sales)
 * plus how many sales are completed vs. still in progress (placed/paid/confirmed
 * but not yet received). Amounts are RWF minor units.
 */
export async function getSellerSales(sellerId: string) {
  const [earned, completed, pending] = await Promise.all([
    prisma.order.aggregate({ where: { sellerId, status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.order.count({ where: { sellerId, status: 'COMPLETED' } }),
    prisma.order.count({
      where: { sellerId, status: { in: ['PENDING_PAYMENT', 'BUYER_MARKED_PAID', 'SELLER_CONFIRMED'] } },
    }),
  ]);
  return { totalEarned: earned._sum.amount ?? 0, completed, pending };
}
