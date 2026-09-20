import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { userRoute } from '@/lib/user-route';
import { authorize } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { recomputeListingRating } from '@/lib/reviews';

const schema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/orders/[id]/review — buyer reviews the seller after completion.
 * Writes once; the seller's aggregate rating is computed live everywhere it's
 * read (profile + every active listing), so there's no cache to invalidate.
 */
export const POST = userRoute(async (req, ctx: { params: { id: string } }, { user }) => {
  const { rating, comment } = schema.parse(await req.json().catch(() => ({})));

  const order = await prisma.order.findUnique({
    where: { id: ctx.params.id },
    select: { id: true, buyerId: true, sellerId: true, listingId: true, status: true, reviewed: true, transactionId: true, listing: { select: { title: true } } },
  });
  if (!order) throw new ApiError('NOT_FOUND', 'Order not found.');
  await authorize(user, 'order:review', order, { message: 'Only the buyer can review.' });
  if (order.status !== 'COMPLETED') throw new ApiError('CONFLICT', 'You can review after completing the order.');
  if (order.reviewed) throw new ApiError('CONFLICT', 'You already reviewed this order.');

  // One review rates BOTH the seller (revieweeId) and the product (listingId).
  await prisma.$transaction([
    prisma.review.create({
      data: {
        reviewerId: user.id,
        revieweeId: order.sellerId,
        listingId: order.listingId,
        rating,
        comment,
        transactionId: order.transactionId,
      },
    }),
    prisma.order.update({ where: { id: order.id }, data: { reviewed: true } }),
  ]);
  await recomputeListingRating(order.listingId);

  await notify({
    userId: order.sellerId,
    type: 'REVIEW_RECEIVED',
    title: 'New review',
    body: `${user.fullName} left you a ${rating}★ review.`,
    href: '/profile',
  });

  return { data: { ok: true } };
});
