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
        // AI and Generative Engine crawlers (OpenAI, Perplexity, Anthropic, Google Gemini, Cohere)
        // Allowed to index public brand and marketplace content for Generative Engine Optimization (GEO)
        userAgent: [
          'GPTBot',
          'CCBot',
          'anthropic-ai',
          'Claude-Web',
          'PerplexityBot',
          'Google-Extended',
          'cohere-ai',
        ],
        allow: [
          '/',
          '/en/',
          '/rw/',
          '/fr/',
          '/en/marketplace',
          '/rw/marketplace',
          '/fr/marketplace',
          '/en/jobs',
          '/rw/jobs',
          '/fr/jobs',
          '/en/about',
          '/rw/about',
          '/fr/about',
          '/en/how-it-works',
          '/rw/how-it-works',
          '/fr/how-it-works',
          '/en/safety',
          '/rw/safety',
          '/fr/safety',
        ],
        disallow: [
          '/*/dashboard',
          '/*/dashboard/*',
          '/*/admin',
          '/*/admin/*',
          '/*/messages',
          '/*/messages/*',
          '/*/profile/settings',
          '/*/profile/applications',
          '/*/orders',
          '/*/orders/*',
          '/*/wallet',
          '/api/',
          '/uploads/private/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
