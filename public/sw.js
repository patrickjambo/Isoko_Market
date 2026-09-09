/*
 * Isoko service worker — an offline app shell for a mobile-first, low-connectivity
 * audience. Strategy:
 *   - static assets (/_next/static, icons, fonts, images): stale-while-revalidate,
 *     so an installed app opens instantly and its shell loads offline;
 *   - page navigations: network-first, falling back to a branded /offline.html
 *     when the network is unreachable;
 *   - /api and any non-GET request: always network, never cached — personalized
 *     and authenticated data must not be served stale or across users.
 * Bump VERSION on each deploy that changes precached assets to drop old caches.
 */
const VERSION = 'v1';
const STATIC_CACHE = `isoko-static-${VERSION}`;
const PRECACHE = ['/offline.html', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Let a freshly loaded page tell an updated worker to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/apple-icon' ||
    /\.(?:css|js|woff2?|png|jpe?g|gif|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never touch mutations
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // map tiles, geocoding, etc. pass through
  if (url.pathname.startsWith('/api/')) return; // dynamic/auth data — always network

  // Page navigations: try the network for fresh content, fall back to offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  // Static assets: serve cache immediately, refresh in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
