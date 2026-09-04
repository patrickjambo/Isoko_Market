import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { RWANDA_DISTRICT_POS } from './rwanda';
import type { ListingFilter } from './validators/listing';
import type { JobFilter } from './validators/job';

/** Active-listing counts per district, for the schematic map view (Section 3). */
export async function getDistrictCounts(): Promise<Record<string, number>> {
  const rows = await prisma.listing.groupBy({
    by: ['location'],
    where: { status: 'ACTIVE' },
    _count: true,
  });
  const counts: Record<string, number> = {};
  for (const { name } of RWANDA_DISTRICT_POS) counts[name] = 0;
  for (const r of rows) {
    const loc = r.location.toLowerCase();
    for (const { name } of RWANDA_DISTRICT_POS) {
      if (loc.includes(name.toLowerCase())) {
        counts[name] = (counts[name] ?? 0) + r._count;
        break;
      }
    }
  }
  return counts;
}

const PAGE_SIZE = 12;

const listingCardSelect = {
  id: true,
  title: true,
  price: true,
  location: true,
  status: true,
  isFeatured: true,
  images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
  category: { select: { slug: true } },
  seller: { select: { fullName: true, isVerified: true, verificationStatus: true } },
} satisfies Prisma.ListingSelect;

export async function getFeaturedListings(take = 8) {
  return prisma.listing.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take,
    select: listingCardSelect,
  });
}

export async function searchListings(filter: ListingFilter) {
  const where: Prisma.ListingWhereInput = { status: 'ACTIVE' };

  if (filter.q) {
    where.OR = [
      { title: { contains: filter.q, mode: 'insensitive' } },
      { description: { contains: filter.q, mode: 'insensitive' } },
    ];
  }
  if (filter.categoryId) where.categoryId = filter.categoryId;
  if (filter.condition) where.condition = filter.condition;
  if (filter.location) where.location = { contains: filter.location, mode: 'insensitive' };
  if (filter.verifiedOnly) where.seller = { isVerified: true };
  if (filter.minPrice != null || filter.maxPrice != null) {
    where.price = {};
    if (filter.minPrice != null) where.price.gte = filter.minPrice * 100;
    if (filter.maxPrice != null) where.price.lte = filter.maxPrice * 100;
  }

  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    filter.sort === 'price_asc'
      ? [{ price: 'asc' }]
      : filter.sort === 'price_desc'
        ? [{ price: 'desc' }]
        : [{ isFeatured: 'desc' }, { createdAt: 'desc' }];

  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy,
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: listingCardSelect,
    }),
    prisma.listing.count({ where }),
  ]);

  return { items, total, page: filter.page, pageSize: PAGE_SIZE };
}

export async function getListing(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: 'asc' } },
      category: true,
      seller: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          paymentNumber: true, // gates "Buy Now" (seller must have a payout number)
          avatarUrl: true,
          location: true,
          isVerified: true,
          verificationStatus: true,
          createdAt: true,
          lastActiveAt: true,
          _count: { select: { listings: true, reviewsReceived: true } },
        },
      },
    },
  });
  // Defense-in-depth: the seller's phone is needed only when they've opted in
  // (showPhone). The detail page already gates *rendering* on showPhone; nulling
  // it here means the number never rides along in the returned object for a
  // non-opted-in seller, so a future client-prop change can't leak it.
  if (listing && !listing.showPhone) listing.seller.phone = '';
  return listing;
}

/** Similar active listings in the same category (for the buyer "Similar" carousel). */
export async function getSimilarListings(listing: {
  id: string;
  categoryId: string | null;
  location: string;
}) {
  return prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      id: { not: listing.id },
      ...(listing.categoryId ? { categoryId: listing.categoryId } : {}),
    },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take: 6,
    select: {
      id: true,
      title: true,
      price: true,
      location: true,
      status: true,
      isFeatured: true,
      images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } },
      seller: { select: { fullName: true, isVerified: true, verificationStatus: true } },
    },
  });
}

const jobCardSelect = {
  id: true,
  title: true,
  type: true,
  payMin: true,
  payMax: true,
  payPeriod: true,
  location: true,
  skills: true,
  createdAt: true,
  employer: { select: { fullName: true, isVerified: true } },
} satisfies Prisma.JobSelect;

export async function getLatestJobs(take = 6) {
  return prisma.job.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    take,
    select: jobCardSelect,
  });
}

export async function searchJobs(filter: JobFilter) {
  const where: Prisma.JobWhereInput = { status: 'OPEN' };
  if (filter.q) {
    where.OR = [
      { title: { contains: filter.q, mode: 'insensitive' } },
      { description: { contains: filter.q, mode: 'insensitive' } },
    ];
  }
  if (filter.type) where.type = filter.type;
  if (filter.location) where.location = { contains: filter.location, mode: 'insensitive' };
  if (filter.minPay != null) where.payMax = { gte: filter.minPay * 100 };

  const [items, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: jobCardSelect,
    }),
    prisma.job.count({ where }),
  ]);

  return { items, total, page: filter.page, pageSize: PAGE_SIZE };
}

export async function getJob(id: string) {
  return prisma.job.findUnique({
    where: { id },
    include: {
      employer: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          location: true,
          isVerified: true,
          verificationStatus: true,
          createdAt: true,
          lastActiveAt: true,
        },
      },
      _count: { select: { applications: true } },
    },
  });
}

export async function getPlatformStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [users, listings, transactions, jobs, filled, newToday] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count({ where: { status: 'ACTIVE' } }),
    prisma.transaction.count({ where: { status: 'SUCCESS' } }),
    prisma.job.count(),
    prisma.application.count({ where: { status: 'HIRED' } }),
    // Live freshness signal — climbs as sellers post, so the homepage visibly
    // moves on its own with the poll-refresh below.
    prisma.listing.count({ where: { status: 'ACTIVE', createdAt: { gte: since } } }),
  ]);
  return { users, listings, transactions, jobs, filled, newToday };
}

/**
 * Personalized buyer-home data (Section 2): recently viewed, active orders, and
 * a "For You" feed drawn from the categories the buyer has actually engaged with
 * — no manual preferences (Section 9). All from real data, cheaply.
 */
export async function getBuyerHome(userId: string, location?: string | null) {
  const recentViews = await prisma.listingView.findMany({
    where: { userId, listing: { status: 'ACTIVE' } },
    orderBy: { viewedAt: 'desc' },
    take: 10,
    select: { listing: { select: { categoryId: true, ...listingCardSelect } } },
  });
  const recentlyViewed = recentViews.map((v) => v.listing);

  const categoryIds = [...new Set(recentlyViewed.map((l) => l.categoryId).filter(Boolean))] as string[];
  const seenIds = recentlyViewed.map((l) => l.id);

  const [activeOrders, forYou] = await Promise.all([
    prisma.order.findMany({
      where: { buyerId: userId, status: { in: ['PAYMENT_SENT', 'SELLER_CONFIRMED'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        amount: true,
        listing: { select: { title: true, images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } } } },
      },
    }),
    categoryIds.length
      ? prisma.listing.findMany({
          where: { status: 'ACTIVE', sellerId: { not: userId }, categoryId: { in: categoryIds }, id: { notIn: seenIds } },
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
          take: 8,
          select: listingCardSelect,
        })
      : Promise.resolve([]),
  ]);

  const [trending, recommendedSellers] = await Promise.all([
    getTrending(location, seenIds),
    getRecommendedSellers(userId, categoryIds),
  ]);

  return {
    recentlyViewed,
    activeOrders: activeOrders.map((o) => ({
      id: o.id,
      status: o.status,
      amount: o.amount,
      title: o.listing.title,
      image: o.listing.images[0]?.url ?? null,
    })),
    forYou,
    trending,
    recommendedSellers,
  };
}

/** Popular active listings in the buyer's district (Section 2 — Trending Near You). */
export async function getTrending(location?: string | null, exclude: string[] = []) {
  const district = location ? location.split(',').slice(-1)[0]!.trim() : null;
  const base = { status: 'ACTIVE' as const, id: { notIn: exclude } };
  let items = await prisma.listing.findMany({
    where: district ? { ...base, location: { contains: district, mode: 'insensitive' } } : base,
    orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
    take: 8,
    select: listingCardSelect,
  });
  if (items.length < 4) {
    items = await prisma.listing.findMany({
      where: base,
      orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      select: listingCardSelect,
    });
  }
  return items;
}

/** Verified, highly-rated sellers in the buyer's categories (builds trust — Section 2). */
export async function getRecommendedSellers(buyerId: string, categoryIds: string[]) {
  const candidates = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      sellerId: { not: buyerId },
      seller: { isVerified: true },
      ...(categoryIds.length ? { categoryId: { in: categoryIds } } : {}),
    },
    select: { sellerId: true },
    distinct: ['sellerId'],
    take: 20,
  });
  const ids = candidates.map((c) => c.sellerId);
  if (ids.length === 0) return [];

  const [sellers, ratings, sales] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, avatarUrl: true, location: true },
    }),
    prisma.review.groupBy({ by: ['revieweeId'], where: { revieweeId: { in: ids } }, _avg: { rating: true }, _count: true }),
    prisma.order.groupBy({ by: ['sellerId'], where: { sellerId: { in: ids }, status: 'COMPLETED' }, _count: true }),
  ]);
  const ratingMap = new Map(ratings.map((r) => [r.revieweeId, { avg: r._avg.rating ?? 0, count: r._count }]));
  const salesMap = new Map(sales.map((s) => [s.sellerId, s._count]));

  return sellers
    .map((s) => ({
      id: s.id,
      fullName: s.fullName,
      avatarUrl: s.avatarUrl,
      location: s.location,
      rating: ratingMap.get(s.id)?.avg ?? 0,
      reviews: ratingMap.get(s.id)?.count ?? 0,
      sales: salesMap.get(s.id) ?? 0,
    }))
    .sort((a, b) => b.rating - a.rating || b.sales - a.sales)
    .slice(0, 4);
}

/** Which of the given listing ids the user has favourited (for card hearts). */
export async function favoritedSet(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await prisma.favorite.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}

// ─────────────────────── Job seeker ───────────────────────

/** The stored skill keys on a user's CV (empty if no CV). Powers match scoring. */
export async function getCvSkills(userId: string): Promise<string[]> {
  const cv = await prisma.cV.findUnique({ where: { userId }, select: { structuredData: true } });
  const data = cv?.structuredData as { skills?: unknown } | null;
  const skills = Array.isArray(data?.skills) ? (data!.skills as unknown[]) : [];
  return skills.filter((s): s is string => typeof s === 'string');
}

/** Rough CV completeness 0..1 from which optional sections are filled (§2 card). */
export function cvCompleteness(data: {
  skills?: unknown;
  experience?: unknown;
  education?: unknown;
  headline?: unknown;
  summary?: unknown;
} | null): { percent: number; nextStep: string | null } {
  if (!data) return { percent: 0, nextStep: 'skills' };
  const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim()));
  // Weighted: skills carry the most (§3 — only headline + skills are required).
  const steps: [string, boolean, number][] = [
    ['skills', has(data.skills), 0.35],
    ['headline', has(data.headline), 0.15],
    ['experience', has(data.experience), 0.2],
    ['education', has(data.education), 0.15],
    ['summary', has(data.summary), 0.15],
  ];
  const percent = Math.round(steps.reduce((a, [, ok, w]) => a + (ok ? w : 0), 0) * 100);
  const nextStep = steps.find(([, ok]) => !ok)?.[0] ?? null;
  return { percent, nextStep };
}

/**
 * Job Seeker home data (§2): CV completeness, application counts by stage,
 * skill-matched "Recommended for you", and time-sensitive "Nearby gigs today".
 * All from real data — recommendations reflect true CV↔job skill overlap (§4).
 */
export async function getSeekerHome(userId: string, location?: string | null) {
  const cv = await prisma.cV.findUnique({ where: { userId }, select: { structuredData: true } });
  const cvData = (cv?.structuredData ?? null) as Parameters<typeof cvCompleteness>[0];
  const completeness = cvCompleteness(cvData);
  const skills = (Array.isArray(cvData?.skills) ? cvData!.skills : []).filter(
    (s): s is string => typeof s === 'string'
  );

  const district = location ? location.split(',').slice(-1)[0]!.trim() : null;

  const [statusRows, recommended, nearbyGigs] = await Promise.all([
    prisma.application.groupBy({
      by: ['status'],
      where: { applicantId: userId },
      _count: true,
    }),
    // Recommend open jobs whose required skills overlap the seeker's CV skills.
    skills.length
      ? prisma.job.findMany({
          where: { status: 'OPEN', employerId: { not: userId }, skills: { hasSome: skills } },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: jobCardSelect,
        })
      : Promise.resolve([]),
    // Time-sensitive: recent gigs near the seeker (§2 Nearby Gigs Today).
    prisma.job.findMany({
      where: {
        status: 'OPEN',
        type: 'GIG',
        employerId: { not: userId },
        ...(district ? { location: { contains: district, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: jobCardSelect,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const r of statusRows) statusCounts[r.status] = r._count;

  return { skills, completeness, statusCounts, recommended, nearbyGigs };
}

/**
 * Category list is read on nearly every marketplace view but changes rarely,
 * so it is cached (Section 9.3 — "cache read-heavy data"). Tagged 'categories'
 * so it can be revalidated with revalidateTag('categories') on any write.
 */
export const getCategories = unstable_cache(
  async () => prisma.category.findMany({ orderBy: { nameEn: 'asc' } }),
  ['categories'],
  { tags: ['categories'], revalidate: 3600 }
);
