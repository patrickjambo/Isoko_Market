import type { MetadataRoute } from 'next';

/**
 * Web app manifest — makes Isoko installable to a phone's home screen (a big
 * deal for a mobile-first, low-connectivity audience): full-screen, branded,
 * with a home-screen icon. Served at /manifest.webmanifest (outside the i18n
 * middleware, which skips dotted paths).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Isoko Market',
    short_name: 'Isoko',
    description: 'Buy and sell, offer services, and find work near you in Rwanda.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0b6b62',
    categories: ['shopping', 'business'],
    // A scalable SVG icon (full-bleed brand field so it also works maskable) —
    // no binary assets, renders crisp at any home-screen size.
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
