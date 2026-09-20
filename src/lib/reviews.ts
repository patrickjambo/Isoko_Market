import 'server-only';
import { prisma } from './prisma';

/**
 * Recompute a listing's denormalised rating (average + count) from its reviews.
 * Called after any review that targets the listing, so marketplace/home cards can
 * show stars cheaply (no per-card aggregate).
 */
export async function recomputeListingRating(listingId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { listingId },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      ratingCount: agg._count,
    },
  });
}
