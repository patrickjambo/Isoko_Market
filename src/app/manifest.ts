import type { MetadataRoute } from 'next';

/**
 * Web app manifest — makes Zenova installable to a phone's home screen (a big
 * deal for a mobile-first, low-connectivity audience): full-screen, branded,
 * with a home-screen icon. Served at /manifest.webmanifest (outside the i18n
 * middleware, which skips dotted paths).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zenova',
    short_name: 'Zenova',
    description: 'Buy and sell, offer services, and find work near you in Rwanda.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0b6b62',
    categories: ['shopping', 'business'],
    // The Zenova logo (1024×1024, full-bleed brand field so it also works
    // maskable) — renders crisp at any home-screen size.
    icons: [
      { src: '/icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
      { src: '/icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
