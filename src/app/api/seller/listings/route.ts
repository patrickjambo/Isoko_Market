import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createListingSchema } from '@/lib/validators/listing';
import { cleanContact } from '@/lib/contact';
import { francsToMinor } from '@/lib/utils';
import { findDuplicate } from '@/lib/suggestions';
import { emitAdmin } from '@/lib/admin-realtime';
import { notifyMatchingListingAlerts } from '@/lib/listing-alert';

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
      kind: input.kind ?? 'PRODUCT',
      condition: input.condition,
      location: input.location,
      ...(cleanContact(input.contactInfo) ? { contactInfo: cleanContact(input.contactInfo)! } : {}),
      tags: input.tags,
      showPhone: input.showPhone,
      images: { create: input.images.map((url, position) => ({ url, position })) },
    },
    select: { id: true, title: true, description: true, categoryId: true, condition: true, location: true, price: true },
  });

  await prisma.listingDraft.deleteMany({ where: { sellerId: user.id } });
  // Buyers who saved a matching search hear about it immediately (see jobs parity).
  await notifyMatchingListingAlerts({ ...listing, sellerId: user.id });
  // Adopt BUYER→SELLER (see /api/listings): fires only for BUYER, so an ADMIN who
  // sells keeps ADMIN — `role === 'SELLER'` is not "has sold". Query listings.
  if (user.role === 'BUYER') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'SELLER' } });
  }
  await emitAdmin('listing.created', `New listing: ${input.title}`);

  return jsonOk({ id: listing.id }, { status: 201 });
});
