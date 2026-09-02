import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { authorize } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { publish, publishTopic } from '@/lib/realtime';
import { createListingSchema } from '@/lib/validators/listing';
import { cleanContact } from '@/lib/contact';
import { francsToMinor } from '@/lib/utils';

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'SOLD', 'REMOVED', 'PAUSED']),
});

/** PUT /api/listings/[id] — owner edits their listing (title, price, photos, …). */
export const PUT = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const input = createListingSchema.parse(await req.json().catch(() => ({})));

  const listing = await prisma.listing.findUnique({
    where: { id: ctx.params.id },
    select: { sellerId: true },
  });
  if (!listing) throw new ApiError('NOT_FOUND', 'Listing not found.');
  await authorize(user, 'listing:setStatus', listing, {
    message: 'You can only edit your own listings.',
  });

  const contact = cleanContact(input.contactInfo);
  // Replace images wholesale, then update the fields — one atomic edit.
  await prisma.$transaction([
    prisma.listingImage.deleteMany({ where: { listingId: ctx.params.id } }),
    prisma.listing.update({
      where: { id: ctx.params.id },
      data: {
        title: input.title,
        description: input.description,
        price: francsToMinor(input.price),
        categoryId: input.categoryId ?? null,
        condition: input.condition,
        location: input.location,
        tags: input.tags,
        showPhone: input.showPhone,
        contactInfo: contact ?? Prisma.DbNull,
        images: { create: input.images.map((url, position) => ({ url, position })) },
      },
    }),
  ]);

  publishTopic(`listing:${ctx.params.id}`, {
    type: 'entity_update',
    entity: 'listing',
    id: ctx.params.id,
    status: 'ACTIVE',
    reason: 'edited',
  });
  return jsonOk({ id: ctx.params.id });
});

/** PATCH /api/listings/[id] — owner-only status change (e.g. "mark as sold"). */
export const PATCH = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const { status } = patchSchema.parse(await req.json().catch(() => ({})));

  const listing = await prisma.listing.findUnique({
    where: { id: ctx.params.id },
    select: { sellerId: true },
  });
  if (!listing) throw new ApiError('NOT_FOUND', 'Listing not found.');
  await authorize(user, 'listing:setStatus', listing, {
    message: 'You can only change your own listings.',
  });

  await prisma.listing.update({
    where: { id: ctx.params.id },
    // Relisting resets the staleness clock so the freshness cycle restarts.
    data: { status, ...(status === 'ACTIVE' ? { staleNudgedAt: null } : {}) },
  });

  // Propagate to anyone currently viewing this item (Section 9.1): the owner's
  // own tabs (user channel) AND every viewer watching the listing topic.
  const event = { type: 'entity_update', entity: 'listing', id: ctx.params.id, status } as const;
  publish(user.id, event);
  publishTopic(`listing:${ctx.params.id}`, event);

  return jsonOk({ ok: true, status });
});

/** DELETE /api/listings/[id] — soft-remove (owner only). */
export const DELETE = route(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const listing = await prisma.listing.findUnique({
    where: { id: ctx.params.id },
    select: { sellerId: true },
  });
  if (!listing) throw new ApiError('NOT_FOUND', 'Listing not found.');
  await authorize(user, 'listing:delete', listing);

  await prisma.listing.update({ where: { id: ctx.params.id }, data: { status: 'REMOVED' } });
  return jsonOk({ ok: true });
});
