import 'server-only';
import { prisma } from './prisma';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type Suggestion = {
  type: 'add_photos_or_lower' | 'boost_or_category' | 'negotiable_or_lower' | 'still_available';
  listingId: string;
  title: string;
};

export type SellerInsights = {
  activeCount: number;
  soldThisMonth: number;
  viewsTotal: number;
  messagesThisWeek: number;
  messagesPrevWeek: number;
  favoritesTotal: number;
  suggestion: Suggestion | null;
};

/**
 * Lightweight rule engine (Section 5) — not a full analytics suite. Produces the
 * single most useful "Suggested Action" plus the numbers for the Interest card.
 */
export async function getSellerInsights(sellerId: string): Promise<SellerInsights> {
  const now = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now - 7 * DAY);
  const twoWeeksAgo = new Date(now - 14 * DAY);

  const [listings, soldThisMonth, favoritesTotal, messagesThisWeek, messagesPrevWeek] =
    await Promise.all([
      prisma.listing.findMany({
        where: { sellerId, status: 'ACTIVE' },
        select: {
          id: true,
          title: true,
          viewCount: true,
          createdAt: true,
          _count: { select: { conversations: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.listing.count({
        where: { sellerId, status: 'SOLD', updatedAt: { gte: monthStart } },
      }),
      prisma.favorite.count({ where: { listing: { sellerId } } }),
      prisma.conversation.count({
        where: { listing: { sellerId }, createdAt: { gte: weekAgo } },
      }),
      prisma.conversation.count({
        where: { listing: { sellerId }, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
    ]);

  const viewsTotal = listings.reduce((s, l) => s + l.viewCount, 0);

  // Evaluate rules in priority order; return the first strong match.
  let suggestion: Suggestion | null = null;
  for (const l of listings) {
    if (l.viewCount > 10 && l._count.conversations === 0) {
      suggestion = { type: 'add_photos_or_lower', listingId: l.id, title: l.title };
      break;
    }
  }
  if (!suggestion) {
    for (const l of listings) {
      if (now - l.createdAt.getTime() > 2 * DAY && l.viewCount === 0) {
        suggestion = { type: 'boost_or_category', listingId: l.id, title: l.title };
        break;
      }
    }
  }
  if (!suggestion) {
    for (const l of listings) {
      const ageMs = now - l.createdAt.getTime();
      if (l._count.conversations >= 2 && ageMs > 5 * DAY) {
        suggestion = { type: 'negotiable_or_lower', listingId: l.id, title: l.title };
        break;
      }
    }
  }
  if (!suggestion) {
    for (const l of listings) {
      if (now - l.createdAt.getTime() > 30 * DAY) {
        suggestion = { type: 'still_available', listingId: l.id, title: l.title };
        break;
      }
    }
  }

  return {
    activeCount: listings.length,
    soldThisMonth,
    viewsTotal,
    messagesThisWeek,
    messagesPrevWeek,
    favoritesTotal,
    suggestion,
  };
}
