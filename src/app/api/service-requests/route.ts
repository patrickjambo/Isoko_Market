import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { publish } from '@/lib/realtime';
import { createServiceRequestSchema } from '@/lib/validators/service-request';

/**
 * POST /api/service-requests — a seeker formally requests a SERVICE listing,
 * having agreed to the terms. Notifies the provider in real time; the provider
 * then confirms/declines via PATCH.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = createServiceRequestSchema.parse(await req.json().catch(() => ({})));

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, title: true, sellerId: true, kind: true, status: true },
  });
  if (!listing) throw new ApiError('NOT_FOUND', 'Service not found.');
  if (listing.kind !== 'SERVICE') throw new ApiError('BAD_REQUEST', 'This listing is not a service.');
  if (listing.status !== 'ACTIVE') throw new ApiError('CONFLICT', 'This service is no longer available.');
  if (listing.sellerId === user.id) {
    throw new ApiError('BAD_REQUEST', 'You cannot request your own service.');
  }

  // One open request per seeker per service.
  const open = await prisma.serviceRequest.findFirst({
    where: { listingId: listing.id, requesterId: user.id, status: { in: ['REQUESTED', 'CONFIRMED'] } },
    select: { id: true },
  });
  if (open) throw new ApiError('CONFLICT', 'You already have an open request for this service.');

  const sr = await prisma.serviceRequest.create({
    data: {
      listingId: listing.id,
      requesterId: user.id,
      providerId: listing.sellerId,
      note: input.note?.trim() || null,
      agreedTerms: true,
    },
    select: { id: true },
  });

  await notify({
    userId: listing.sellerId,
    type: 'SYSTEM',
    title: 'New service request',
    body: `${user.fullName} requested "${listing.title}"`,
    href: '/dashboard/requests',
    payload: { serviceRequestId: sr.id, listingId: listing.id },
  });
  publish(listing.sellerId, {
    type: 'entity_update',
    entity: 'serviceRequest',
    id: sr.id,
    status: 'REQUESTED',
  });

  return jsonOk({ id: sr.id }, { status: 201 });
});
