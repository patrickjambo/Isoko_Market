import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createListingSchema } from '@/lib/validators/listing';
import { francsToMinor } from '@/lib/utils';
import { findDuplicate } from '@/lib/suggestions';
import { emitAdmin } from '@/lib/admin-realtime';

/**
 * POST /api/seller/listings?force= — publish a listing from the wizard.
 * Warns about a near-identical active listing (unless ?force=1), then creates
 * the listing, clears the draft, and notifies admins.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const force = new URL(req.url).searchParams.get('force') === '1';
  const input = createListingSchema.parse(await req.json().catch(() => ({})));

  if (!force) {
    const dup = await findDuplicate(user.id, input.title);
    if (dup) return jsonOk({ duplicate: dup });
  }

  const listing = await prisma.listing.create({
    data: {
      sellerId: user.id,
      title: input.title,
      description: input.description,
      price: francsToMinor(input.price),
      categoryId: input.categoryId ?? null,
      condition: input.condition,
      location: input.location,
      tags: input.tags,
      showPhone: input.showPhone,
      images: { create: input.images.map((url, position) => ({ url, position })) },
    },
    select: { id: true },
  });

  await prisma.listingDraft.deleteMany({ where: { sellerId: user.id } });
  if (user.role === 'BUYER') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'SELLER' } });
  }
  await emitAdmin('listing.created', `New listing: ${input.title}`);

  return jsonOk({ id: listing.id }, { status: 201 });
});
