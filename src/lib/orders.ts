import 'server-only';
import type { OrderStatus } from '@prisma/client';
import { prisma } from './prisma';
import { ApiError } from './api';
import { startPayment } from './payments';
import { notify } from './notifications';
import { publishTopic } from './realtime';
import { emitAdmin } from './admin-realtime';

/**
 * Create an order = the single source of truth for a deal (Section 10). In one
 * transaction: charge the buyer into escrow, create the Order, and reserve the
 * listing (mark SOLD so nobody else can buy). Then notify BOTH sides and push
 * the live `listing:sold` event so anyone viewing updates within ~1s.
 */
export async function createOrder(params: {
  buyerId: string;
  buyerPhone: string;
  buyerName: string;
  listingId: string;
  deliveryMethod?: string;
}) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.listingId },
    select: { id: true, sellerId: true, title: true, price: true, status: true },
  });
  if (!listing || listing.status === 'REMOVED') throw new ApiError('NOT_FOUND', 'Listing not found.');
  if (listing.sellerId === params.buyerId) throw new ApiError('BAD_REQUEST', 'You cannot buy your own listing.');
  if (listing.status !== 'ACTIVE') throw new ApiError('CONFLICT', 'This item is no longer available.');

  // Charge into escrow (mock provider succeeds in dev).
  const { transaction, result } = await startPayment({
    userId: params.buyerId,
    phone: params.buyerPhone,
    type: 'ESCROW',
    amount: listing.price,
    metadata: { listingId: listing.id, kind: 'order' },
  });
  if (result.status === 'FAILED') throw new ApiError('BAD_REQUEST', 'Payment failed. Please try again.');

  // Reserve the listing + create the order atomically.
  const [, order] = await prisma.$transaction([
    prisma.listing.update({ where: { id: listing.id }, data: { status: 'SOLD' } }),
    prisma.order.create({
      data: {
        listingId: listing.id,
        buyerId: params.buyerId,
        sellerId: listing.sellerId,
        amount: listing.price,
        status: 'PAYMENT_SENT',
        escrow: true,
        deliveryMethod: params.deliveryMethod,
        transactionId: transaction.id,
      },
      select: { id: true },
    }),
  ]);

  // Propagate to anyone viewing the listing (Section 10).
  publishTopic(`listing:${listing.id}`, { type: 'entity_update', entity: 'listing', id: listing.id, status: 'SOLD', reason: 'sold' });

  // Notify both sides — atomic in intent, never one without the other.
  await Promise.all([
    notify({
      userId: listing.sellerId,
      type: 'PAYMENT',
      title: 'Payment received (in escrow)',
      body: `${params.buyerName} paid for "${listing.title}". Hand over the item, then they confirm receipt.`,
      href: `/orders/${order.id}`,
      payload: { orderId: order.id },
    }),
    notify({
      userId: params.buyerId,
      type: 'PAYMENT',
      title: 'Payment sent',
      body: `Your payment for "${listing.title}" is held in escrow until you confirm receipt.`,
      href: `/orders/${order.id}`,
      payload: { orderId: order.id },
    }),
  ]);
  await emitAdmin('transaction.completed', `Escrow order — RWF ${Math.round(listing.price / 100).toLocaleString()}`);

  return order;
}

/** Release escrowed funds to the seller's wallet (on buyer receipt confirmation). */
export async function releaseEscrow(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { sellerId: true, amount: true, transactionId: true },
  });
  if (!order) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: order.sellerId }, data: { walletBalance: { increment: order.amount } } }),
    ...(order.transactionId
      ? [prisma.transaction.update({ where: { id: order.transactionId }, data: { status: 'SUCCESS' } })]
      : []),
  ]);
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

export const ORDER_FLOW: OrderStatus[] = ['PAYMENT_SENT', 'SELLER_CONFIRMED', 'COMPLETED'];
