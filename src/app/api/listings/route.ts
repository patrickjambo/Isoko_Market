import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createListingSchema, listingFilterSchema } from '@/lib/validators/listing';
import { francsToMinor } from '@/lib/utils';
import { searchListings } from '@/lib/queries';
import { emitAdmin } from '@/lib/admin-realtime';

/** GET /api/listings — public, filtered search (also used by the mobile app). */
export const GET = route(async (req: NextRequest) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const filter = listingFilterSchema.parse(params);
  const result = await searchListings(filter);
  return jsonOk(result);
});

/** POST /api/listings — create a listing (free core action; any logged-in user). */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = createListingSchema.parse(await req.json().catch(() => ({})));

  const listing = await prisma.listing.create({
    data: {
      sellerId: user.id,
      title: input.title,
      description: input.description,
      price: francsToMinor(input.price),
      categoryId: input.categoryId ?? null,
      condition: input.condition,
      location: input.location,
      images: {
        create: input.images.map((url, position) => ({ url, position })),
      },
    },
    select: { id: true },
  });

  // Adopt BUYER→SELLER on first listing so the role reflects usage. This fires
  // ONLY for BUYER: an ADMIN who sells keeps ADMIN, because for admins `role` is
  // a staff-permission level, not a marketplace identity (see role-visibility).
  // So never read `role === 'SELLER'` as "has sold something" — it would miss
  // admin-initiated sales; query the user's listings for that.
  if (user.role === 'BUYER') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'SELLER' } });
  }

  await emitAdmin('listing.created', `New listing: ${input.title}`);

  return jsonOk({ id: listing.id }, { status: 201 });
});
