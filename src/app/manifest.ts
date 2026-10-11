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
    // The Zenova logo in standard PWA sizes (192, 512, 1024) for both any
    // and maskable displays — required by Android Chrome to generate home-screen WebAPKs.
    icons: [
      { src: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.png?v=2', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
      { src: '/icon.png?v=2', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
