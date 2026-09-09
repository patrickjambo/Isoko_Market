import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Listing photos, avatars, ID docs are served from local /uploads in dev.
    // In production they come from the configured object store (STORAGE_DRIVER):
    // Vercel Blob (*.public.blob.vercel-storage.com) or S3/R2.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Deterministic placeholder photos used by the dev seed script.
      { protocol: 'https', hostname: 'picsum.photos' },
      // "Add photo by URL" may reference the source image directly when object
      // storage isn't configured yet (see saveFileFromUrl), so allow any https
      // host. next/image still only serves valid images and caps their size.
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    // The old single-page "new listing" form is retired in favour of the guided
    // wizard at /dashboard/sell (the one flow used everywhere else). Forward any
    // old link/bookmark there with a clean server-side redirect, per locale.
    return [
      {
        source: '/:locale/marketplace/new',
        destination: '/:locale/dashboard/sell',
        permanent: false,
      },
    ];
  },
  async headers() {
    // Baseline security headers (Section 10). HSTS is set at the edge/CDN in prod.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
