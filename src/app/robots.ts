import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/**
 * Tells search engine crawlers which pages to index and which to skip.
 * - Public marketplace, jobs, profiles → allow (the whole point of SEO)
 * - Admin, dashboard, auth, private API → disallow (security + crawl budget)
 * - Private uploads (ID docs, CVs) → always block
 *
 * robots.txt is NOT a security mechanism — real security is on the API/DB side.
 * This file purely guides crawler behaviour and crawl budget allocation.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;

  return {
    rules: [
      {
        // Allow all well-behaved search engines to crawl public content
        userAgent: '*',
        allow: [
          '/',
          '/en/',
          '/rw/',
          '/fr/',
          '/en/marketplace',
          '/en/jobs',
          '/en/about',
          '/en/how-it-works',
          '/en/privacy',
          '/en/terms',
          '/en/safety',
        ],
        disallow: [
          // Auth flows — no SEO value, never index
          '/*/login',
          '/*/register',
          '/*/get-started',
          '/*/magic-link',
          // Private user areas
          '/*/dashboard',
          '/*/dashboard/*',
          '/*/profile/settings',
          '/*/profile/applications',
          '/*/messages',
          '/*/messages/*',
          '/*/notifications',
          '/*/orders',
          '/*/orders/*',
          '/*/wallet',
          '/*/saved',
          '/*/alerts',
          '/*/referrals',
          '/*/verify',
          '/*/cv',
          '/*/post',
          // Employer-only pages
          '/*/employer',
          '/*/employer/*',
          // Job edit / applicant management (private)
          '/*/jobs/*/edit',
          '/*/jobs/*/applicants',
          // Admin area — entirely private
          '/*/admin',
          '/*/admin/*',
          // API routes — never index
          '/api/',
          // Private file uploads (ID documents, CVs, private images)
          '/uploads/private/',
        ],
      },
      {
        // Block AI training crawlers from private/sensitive content
        // (they can still index public marketplace content for GEO purposes)
        userAgent: ['GPTBot', 'CCBot', 'anthropic-ai', 'Claude-Web'],
        allow: [
          '/en/marketplace',
          '/en/jobs',
          '/en/about',
          '/en/how-it-works',
        ],
        disallow: [
          '/*/dashboard',
          '/*/admin',
          '/*/messages',
          '/*/profile/settings',
          '/api/',
          '/uploads/private/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
