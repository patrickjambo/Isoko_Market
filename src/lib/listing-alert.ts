import 'server-only';
import { prisma } from './prisma';
import { notify } from './notifications';

type NewListing = {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  kind: string; // 'PRODUCT' | 'SERVICE'
  condition: string;
  location: string;
  price: number; // minor units (RWF × 100), as stored on Listing
  sellerId: string;
};

/**
 * Evaluate a freshly-created listing against every marketplace saved search
 * (kind = LISTING) AS IT IS CREATED — mirrors the jobs flow (see
 * notifyMatchingSavedSearches) so a buyer waiting on "a phone under 100k in
 * Kigali" hears about it while it's still available. The seller never notifies
 * themselves; each matching buyer is notified at most once.
 */
export async function notifyMatchingListingAlerts(listing: NewListing): Promise<number> {
  const searches = await prisma.savedSearch.findMany({
    where: { kind: 'LISTING', userId: { not: listing.sellerId } },
    select: {
      id: true,
      userId: true,
      label: true,
      q: true,
      location: true,
      categoryId: true,
      condition: true,
      listingKind: true,
      minPrice: true,
      maxPrice: true,
    },
  });
  if (searches.length === 0) return 0;

  const title = listing.title.toLowerCase();
  const description = listing.description.toLowerCase();
  const location = listing.location.toLowerCase();
  const francs = Math.round(listing.price / 100);

  const notified = new Set<string>();
  let count = 0;

  for (const s of searches) {
    if (notified.has(s.userId)) continue;
    if (s.listingKind && s.listingKind !== listing.kind) continue;
    if (s.categoryId && s.categoryId !== listing.categoryId) continue;
    if (s.condition && s.condition !== listing.condition) continue;
    if (s.location && !location.includes(s.location.toLowerCase().split(',')[0]!.trim())) continue;
    if (s.q) {
      const term = s.q.toLowerCase();
      if (!title.includes(term) && !description.includes(term)) continue;
    }
    if (s.minPrice != null && francs < s.minPrice) continue;
    if (s.maxPrice != null && francs > s.maxPrice) continue;
    // A rule with no criteria at all would match everything — skip it.
    if (
      !s.q &&
      !s.location &&
      !s.categoryId &&
      !s.condition &&
      !s.listingKind &&
      s.minPrice == null &&
      s.maxPrice == null
    )
      continue;

    notified.add(s.userId);
    count++;
    await notify({
      userId: s.userId,
      type: 'SYSTEM',
      title: s.label || listing.title,
      body: `New match: ${listing.title}`,
      href: `/marketplace/${listing.id}`,
      payload: { listingId: listing.id, savedSearchId: s.id },
    });
  }
  return count;
}
