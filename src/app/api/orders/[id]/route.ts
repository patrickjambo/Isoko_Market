import { z } from 'zod';
import type { OrderStatus, User } from '@prisma/client';
import { ApiError } from '@/lib/api';
import { userRoute } from '@/lib/user-route';
import { authorize } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { releaseEscrow } from '@/lib/orders';
import { notify } from '@/lib/notifications';
import { publish, publishTopic } from '@/lib/realtime';
import { emitAdmin } from '@/lib/admin-realtime';

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
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          isVerified: true,
          verificationStatus: true,
        },
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
        escrow: order.escrow,
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
  action: z.enum(['confirm', 'receive', 'dispute', 'cancel']),
  reason: z.string().trim().max(500).optional(),
});

/**
 * PATCH /api/orders/[id] — advance the order. Each action is role-checked; state
 * changes notify BOTH sides and push a live `order:<id>` event so the other
 * party's screen updates instantly (Section 10).
 */
export const PATCH = userRoute(async (req, ctx: { params: { id: string } }, { user }) => {
  const { action, reason } = patchSchema.parse(await req.json().catch(() => ({})));
  const order = await loadOrder(ctx.params.id, user);
  const isBuyer = order.buyerId === user.id;

  let next: OrderStatus = order.status;

  if (action === 'confirm') {
    await authorize(user, 'order:sellerConfirm', order, { message: 'Only the seller can confirm.' });
    if (order.status !== 'PAYMENT_SENT') throw new ApiError('CONFLICT', 'Order already advanced.');
    next = 'SELLER_CONFIRMED';
    await prisma.order.update({ where: { id: order.id }, data: { status: next } });
    await notify({
      userId: order.buyerId,
      type: 'PAYMENT',
      title: 'Seller confirmed',
      body: `The seller is handing over "${order.listing.title}". Confirm receipt when you have it.`,
      href: `/orders/${order.id}`,
    });
  } else if (action === 'receive') {
    await authorize(user, 'order:confirmReceipt', order, { message: 'Only the buyer can confirm receipt.' });
    if (order.status === 'COMPLETED') throw new ApiError('CONFLICT', 'Already completed.');
    next = 'COMPLETED';
    await prisma.order.update({ where: { id: order.id }, data: { status: next } });
    await releaseEscrow(order.id); // funds released to seller
    await notify({
      userId: order.sellerId,
      type: 'PAYMENT',
      title: 'Funds released',
      body: `${order.buyer.fullName} confirmed receipt of "${order.listing.title}". Escrow released to your wallet.`,
      href: `/orders/${order.id}`,
    });
  } else if (action === 'dispute') {
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ApiError('CONFLICT', 'This order cannot be disputed.');
    }
    next = 'DISPUTED';
    // Route into the admin moderation queue, pre-filled with the transaction id.
    const report = await prisma.report.create({
      data: {
        reportedById: user.id,
        targetType: 'LISTING',
        targetId: order.listingId,
        reason: 'Order dispute',
        details: `Order ${order.id} · tx ${order.transactionId ?? '—'} · ${reason ?? ''}`.trim(),
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: next, disputeReportId: report.id },
    });
    await notify({
      userId: isBuyer ? order.sellerId : order.buyerId,
      type: 'SYSTEM',
      title: 'Order disputed',
      body: `A dispute was opened on "${order.listing.title}". Our team will review it.`,
      href: `/orders/${order.id}`,
    });
    await emitAdmin('report.created', `Order dispute: ${order.listing.title}`);
  } else {
    // cancel — buyer only, before the seller confirms; refund + relist.
    await authorize(user, 'order:cancel', order, { message: 'Only the buyer can cancel.' });
    if (order.status !== 'PAYMENT_SENT') throw new ApiError('CONFLICT', 'Too late to cancel.');
    next = 'CANCELLED';
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: next } }),
      prisma.listing.update({ where: { id: order.listingId }, data: { status: 'ACTIVE' } }),
      ...(order.transactionId
        ? [prisma.transaction.update({ where: { id: order.transactionId }, data: { status: 'REFUNDED' } })]
        : []),
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
  publishTopic(`order:${order.id}`, { type: 'entity_update', entity: 'order', id: order.id, status: next });
  publish(isBuyer ? order.sellerId : order.buyerId, { type: 'entity_update', entity: 'order', id: order.id, status: next });

  return { data: { status: next } };
});
