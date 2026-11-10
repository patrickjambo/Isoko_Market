import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

/**
 * Dynamic XML sitemap served at /sitemap.xml.
 *
 * Includes:
 *  - Static public pages (homepage, about, jobs, marketplace, etc.)
 *  - All ACTIVE public listing detail pages (auto-updated)
 *  - All OPEN public job detail pages (auto-updated)
 *
 * Excludes (never indexed):
 *  - Admin, dashboard, auth, messages, orders, private profile pages
 *  - REMOVED / DRAFT / SOLD listings (no SEO value)
 *  - CLOSED / FILLED jobs
 *
 * Revalidates every 12 hours so new listings appear in Google within half a day.
 * Individual listing pages also emit their own lastModified so Google only
 * re-crawls changed content.
 */

const BASE = env.NEXT_PUBLIC_APP_URL;
const LOCALES = ['en', 'rw', 'fr'] as const;

// 12-hour revalidation — balances freshness vs. DB query cost
export const revalidate = 43200;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // ── Static public pages ────────────────────────────────────────────────
  // These rarely change — weekly revalidation is fine
  const staticPaths = [
    '',              // homepage
    '/marketplace',
    '/jobs',
    '/about',
    '/how-it-works',
    '/privacy',
    '/terms',
    '/safety',
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: `${BASE}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === '' ? ('daily' as const) : ('weekly' as const),
      priority: path === '' ? 1.0 : 0.8,
      // hreflang alternates for multi-language awareness
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, `${BASE}/${l}${path}`])
        ),
      },
    }))
  );

  // ── Active public listings ─────────────────────────────────────────────
  // Only ACTIVE listings — REMOVED/DRAFT/SOLD return 404 so never index them
  let listingEntries: MetadataRoute.Sitemap = [];
  try {
    const listings = await prisma.listing.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      // Cap at 40,000 listings per sitemap (Google max is 50,000 URLs)
      // Add sitemap index split if you ever exceed this
      take: 40000,
    });

    listingEntries = listings.flatMap((listing) =>
      LOCALES.map((locale) => ({
        url: `${BASE}/${locale}/marketplace/${listing.id}`,
        lastModified: listing.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((l) => [l, `${BASE}/${l}/marketplace/${listing.id}`])
          ),
        },
      }))
    );
  } catch (err) {
    // Never crash the sitemap — return static entries only if DB is unreachable
    console.error('[sitemap] Failed to load listings:', err);
  }

  // ── Open public jobs ───────────────────────────────────────────────────
  // Only OPEN jobs — CLOSED/FILLED return 404 so never index them
  let jobEntries: MetadataRoute.Sitemap = [];
  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'OPEN' },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 10000,
    });

    jobEntries = jobs.flatMap((job) =>
      LOCALES.map((locale) => ({
        url: `${BASE}/${locale}/jobs/${job.id}`,
        lastModified: job.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((l) => [l, `${BASE}/${l}/jobs/${job.id}`])
          ),
        },
      }))
    );
  } catch (err) {
    console.error('[sitemap] Failed to load jobs:', err);
  }

  return [...staticEntries, ...listingEntries, ...jobEntries];
}
