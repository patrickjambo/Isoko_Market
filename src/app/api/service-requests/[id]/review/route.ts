import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { recomputeListingRating } from '@/lib/reviews';

const schema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/service-requests/[id]/review — the seeker reviews a service after the
 * provider marked it COMPLETED. Rates both the provider (revieweeId) and the
 * service listing (listingId); one review per completed request.
 */
export const POST = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const { rating, comment } = schema.parse(await req.json().catch(() => ({})));

  const sr = await prisma.serviceRequest.findUnique({
    where: { id: ctx.params.id },
    select: {
      id: true,
      requesterId: true,
      providerId: true,
      listingId: true,
      status: true,
      listing: { select: { title: true } },
    },
  });
  if (!sr) throw new ApiError('NOT_FOUND', 'Request not found.');
  if (sr.requesterId !== user.id) throw new ApiError('FORBIDDEN', 'Only the client can review.');
  if (sr.status !== 'COMPLETED') throw new ApiError('CONFLICT', 'You can review after the service is completed.');

  const existing = await prisma.review.findFirst({
    where: { serviceRequestId: sr.id },
    select: { id: true },
  });
  if (existing) throw new ApiError('CONFLICT', 'You already reviewed this service.');

  await prisma.review.create({
    data: {
      reviewerId: user.id,
      revieweeId: sr.providerId,
      listingId: sr.listingId,
      serviceRequestId: sr.id,
      rating,
      comment,
    },
  });
  await recomputeListingRating(sr.listingId);

  await notify({
    userId: sr.providerId,
    type: 'REVIEW_RECEIVED',
    title: 'New review',
    body: `${user.fullName} rated "${sr.listing.title}" ${rating}★.`,
    href: '/profile',
  });

  return jsonOk({ ok: true });
});
