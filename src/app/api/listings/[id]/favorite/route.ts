import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';

/**
 * POST /api/listings/[id]/favorite — toggle a favourite. When a buyer favourites
 * a listing, the seller gets an instant real-time push (Section 7) via notify().
 */
export const POST = route(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();

  const listing = await prisma.listing.findUnique({
    where: { id: ctx.params.id },
    select: { id: true, sellerId: true, title: true, status: true },
  });
  if (!listing || listing.status === 'REMOVED') {
    throw new ApiError('NOT_FOUND', 'Listing not found.');
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId: user.id, listingId: listing.id } },
    select: { id: true },
  });

  let favorited: boolean;
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    favorited = false;
  } else {
    await prisma.favorite.create({ data: { userId: user.id, listingId: listing.id } });
    favorited = true;
    // Live-notify the seller (not on self-favourite).
    if (listing.sellerId !== user.id) {
      await notify({
        userId: listing.sellerId,
        type: 'FAVORITE',
        title: 'Someone saved your listing',
        body: `${user.fullName} saved "${listing.title}"`,
        href: `/marketplace/${listing.id}`,
        payload: { listingId: listing.id },
      });
    }
  }

  const count = await prisma.favorite.count({ where: { listingId: listing.id } });
  return jsonOk({ favorited, count });
});
