import { z } from 'zod';
import type { OrderStatus, User } from '@prisma/client';
import { ApiError } from '@/lib/api';
import { userRoute } from '@/lib/user-route';
import { authorize } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { publish, publishTopic } from '@/lib/realtime';
import { emitAdmin } from '@/lib/admin-realtime';

const rwf = (minor: number) => Math.round(minor / 100).toLocaleString();
const methodLabel = (m: string) => (m === 'manual_airtel' ? 'Airtel Money' : 'MoMo');

async function loadOrder(id: string, actor: User) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          location: true,
          images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } },
        },
      },
      buyer: { select: { id: true, fullName: true, avatarUrl: true } },
      seller: {
        select: { id: true, fullName: true, avatarUrl: true, isVerified: true, verificationStatus: true },
      },
    },
  });
  if (!order) throw new ApiError('NOT_FOUND', 'Order not found.');
  await authorize(actor, 'order:view', order, { message: 'Not your order.' });
  return order;
}

/** GET /api/orders/[id] — order detail (participant only). */
export const GET = userRoute(async (_req, ctx: { params: { id: string } }, { user }) => {
  const order = await loadOrder(ctx.params.id, user);
  return {
    data: {
      order: {
        id: order.id,
        status: order.status,
        amount: order.amount,
        paymentMethod: order.paymentMethod,
        sellerPayoutNumber: order.sellerPayoutNumber,
        buyerMarkedPaidAt: order.buyerMarkedPaidAt?.toISOString() ?? null,
        buyerPaymentProofUrl: order.buyerPaymentProofUrl,
        sellerConfirmedAt: order.sellerConfirmedAt?.toISOString() ?? null,
        deliveryMethod: order.deliveryMethod,
        reviewed: order.reviewed,
        role: order.buyerId === user.id ? 'buyer' : 'seller',
        listing: order.listing,
        buyer: order.buyer,
        seller: order.seller,
        createdAt: order.createdAt.toISOString(),
      },
    },
  };
});

const patchSchema = z.object({
  action: z.enum(['mark_paid', 'confirm', 'receive', 'dispute', 'cancel']),
  proofUrl: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(500).optional(),
});

/**
 * PATCH /api/orders/[id] — advance the MANUAL peer-to-peer order. No money moves
 * through the platform: the buyer sends it to the seller's number off-platform,
 * then each side confirms in-app, role-checked at every step. Every transition
 * notifies the other party and pushes a live `order:<id>` event (reason values
 * buyer_paid | seller_confirmed | item_received | disputed | cancelled) so their
 * screen updates within ~1s (Section 10 / Rule 6).
 */
export const PATCH = userRoute(async (req, ctx: { params: { id: string } }, { user }) => {
  const { action, proofUrl, reason } = patchSchema.parse(await req.json().catch(() => ({})));
  const order = await loadOrder(ctx.params.id, user);
  const isBuyer = order.buyerId === user.id;

  let next: OrderStatus = order.status;
  let evReason = '';

  if (action === 'mark_paid') {
    // Buyer explicitly confirms they've sent the money (never auto-assumed).
    if (!isBuyer) throw new ApiError('FORBIDDEN', 'Only the buyer can mark the payment sent.');
    if (order.status !== 'PENDING_PAYMENT') throw new ApiError('CONFLICT', 'Order already advanced.');
    next = 'BUYER_MARKED_PAID';
    evReason = 'buyer_paid';
    await prisma.order.update({
      where: { id: order.id },
      data: { status: next, buyerMarkedPaidAt: new Date(), buyerPaymentProofUrl: proofUrl ?? null },
    });
    await notify({
      userId: order.sellerId,
      type: 'PAYMENT',
      title: 'Buyer sent payment',
      body: `${order.buyer.fullName} says they sent RWF ${rwf(order.amount)} for "${order.listing.title}". Check your ${methodLabel(order.paymentMethod)} app, then confirm once received.`,
      href: `/orders/${order.id}`,
    });
  } else if (action === 'confirm') {
    // Seller confirms the money actually arrived (checked in their own app).
    await authorize(user, 'order:sellerConfirm', order, { message: 'Only the seller can confirm.' });
    if (order.status !== 'BUYER_MARKED_PAID') throw new ApiError('CONFLICT', 'Order already advanced.');
    next = 'SELLER_CONFIRMED';
    evReason = 'seller_confirmed';
    await prisma.order.update({ where: { id: order.id }, data: { status: next, sellerConfirmedAt: new Date() } });
    await notify({
      userId: order.buyerId,
      type: 'PAYMENT',
      title: 'Seller confirmed payment',
      body: `The seller confirmed your payment for "${order.listing.title}". Arrange pickup/delivery, then confirm once you have the item.`,
      href: `/orders/${order.id}`,
    });
  } else if (action === 'receive') {
    // Buyer confirms they got the item → complete, unlocks the review flow.
    await authorize(user, 'order:confirmReceipt', order, { message: 'Only the buyer can confirm receipt.' });
    if (order.status === 'COMPLETED') throw new ApiError('CONFLICT', 'Already completed.');
    next = 'COMPLETED';
    evReason = 'item_received';
    await prisma.order.update({ where: { id: order.id }, data: { status: next } });
    await notify({
      userId: order.sellerId,
      type: 'PAYMENT',
      title: 'Order completed',
      body: `${order.buyer.fullName} confirmed receiving "${order.listing.title}". The order is complete.`,
      href: `/orders/${order.id}`,
    });
  } else if (action === 'dispute') {
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ApiError('CONFLICT', 'This order cannot be disputed.');
    }
    next = 'DISPUTED';
    evReason = 'disputed';
    // The platform's trust backstop: no API-verified proof exists, so pre-attach
    // the full timeline (both timestamps + proof image if any) for admin review.
    const timeline = [
      `Order ${order.id} — "${order.listing.title}" · RWF ${rwf(order.amount)}`,
      `Payment: ${methodLabel(order.paymentMethod)} → ${order.sellerPayoutNumber ?? '—'}`,
      `Placed: ${order.createdAt.toISOString()}`,
      order.buyerMarkedPaidAt ? `Buyer marked paid: ${order.buyerMarkedPaidAt.toISOString()}` : 'Buyer has NOT marked paid',
      order.sellerConfirmedAt ? `Seller confirmed received: ${order.sellerConfirmedAt.toISOString()}` : 'Seller has NOT confirmed',
      order.buyerPaymentProofUrl ? `Proof of payment: ${order.buyerPaymentProofUrl}` : 'No proof-of-payment image provided',
      reason ? `Opened by ${isBuyer ? 'buyer' : 'seller'}: ${reason}` : `Opened by ${isBuyer ? 'buyer' : 'seller'}`,
    ]
      .filter(Boolean)
      .join('\n');
    const report = await prisma.report.create({
      data: {
        reportedById: user.id,
        targetType: 'LISTING',
        targetId: order.listingId,
        reason: 'Order dispute',
        details: timeline,
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: next, disputeReportId: report.id } });
    await notify({
      userId: isBuyer ? order.sellerId : order.buyerId,
      type: 'SYSTEM',
      title: 'Order disputed',
      body: `A dispute was opened on "${order.listing.title}". Our team will review it.`,
      href: `/orders/${order.id}`,
    });
    await emitAdmin('report.created', `Order dispute: ${order.listing.title}`);
  } else {
    // cancel — buyer only, before they've marked paid (nothing sent yet); relist.
    await authorize(user, 'order:cancel', order, { message: 'Only the buyer can cancel.' });
    if (order.status !== 'PENDING_PAYMENT') throw new ApiError('CONFLICT', 'Too late to cancel.');
    next = 'CANCELLED';
    evReason = 'cancelled';
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: next } }),
      prisma.listing.update({ where: { id: order.listingId }, data: { status: 'ACTIVE' } }),
    ]);
    publishTopic(`listing:${order.listingId}`, { type: 'entity_update', entity: 'listing', id: order.listingId, status: 'ACTIVE', reason: 'relisted' });
    await notify({
      userId: order.sellerId,
      type: 'SYSTEM',
      title: 'Order cancelled',
      body: `The buyer cancelled the order for "${order.listing.title}". It's active again.`,
      href: `/marketplace/${order.listingId}`,
    });
  }

  // Live-sync the order screen for the other participant.
  publishTopic(`order:${order.id}`, { type: 'entity_update', entity: 'order', id: order.id, status: next, reason: evReason });
  publish(isBuyer ? order.sellerId : order.buyerId, { type: 'entity_update', entity: 'order', id: order.id, status: next, reason: evReason });

  return { data: { status: next } };
});
