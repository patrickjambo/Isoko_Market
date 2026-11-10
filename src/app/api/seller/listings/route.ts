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
import { getPlatformSettings } from '@/lib/commission';

/**
 * POST /api/seller/listings?force= — publish a listing from the wizard.
 * Warns about a near-identical active listing (unless ?force=1), then creates
 * the listing, clears the draft, and notifies admins.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const force = new URL(req.url).searchParams.get('force') === '1';
  const input = createListingSchema.parse(await req.json().catch(() => ({})));

  // Subscription gate: if admin requires an active subscription to publish, enforce it.
  const settings = await getPlatformSettings();
  if (settings.subscriptionEnabled && settings.subscriptionRequireOnPublish) {
    const now = new Date();
    const hasActiveSub =
      user.subscriptionStatus === 'ACTIVE' &&
      user.subscriptionExpiresAt !== null &&
      user.subscriptionExpiresAt > now;
    if (!hasActiveSub) {
      return jsonOk({ requiresSubscription: true }, { status: 402 });
    }
  }

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
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      ...(cleanContact(input.contactInfo) ? { contactInfo: cleanContact(input.contactInfo)! } : {}),
      ...(input.specs?.length ? { specs: input.specs } : {}),
      tags: input.tags,
      showPhone: input.showPhone,
      images: { create: input.images.map((url, position) => ({ url, position })) },
    },
    select: { id: true, title: true, description: true, categoryId: true, kind: true, condition: true, location: true, price: true },
  });

  await prisma.listingDraft.deleteMany({ where: { sellerId: user.id } }).catch(() => {});
  // Buyers who saved a matching search hear about it immediately (see jobs parity).
  // Wrapped safely so alert dispatch failures never prevent listing creation.
  try {
    await notifyMatchingListingAlerts({ ...listing, sellerId: user.id });
  } catch (err) {
    console.error('[seller/listings] Failed to notify matching alerts:', err);
  }
  // Adopt BUYER→SELLER (see /api/listings): fires only for BUYER, so an ADMIN who
  // sells keeps ADMIN — `role === 'SELLER'` is not "has sold". Query listings.
  if (user.role === 'BUYER') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'SELLER' } }).catch(() => {});
  }
  await emitAdmin('listing.created', `New listing: ${input.title}`).catch(() => {});

  return jsonOk({ id: listing.id }, { status: 201 });
});
