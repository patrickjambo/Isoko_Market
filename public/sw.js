/*
 * Zenova service worker — an offline app shell for a mobile-first, low-connectivity
 * audience. Strategy:
 *   - static assets (/_next/static, icons, fonts, images): stale-while-revalidate,
 *     so an installed app opens instantly and its shell loads offline;
 *   - page navigations: network-first, falling back to a branded /offline.html
 *     when the network is unreachable;
 *   - /api and any non-GET request: always network, never cached — personalized
 *     and authenticated data must not be served stale or across users.
 *
 * Performance notes:
 *   - The install step precaches the offline shell and brand icons so the first
 *     cold-start from the home screen never needs a network round-trip for these.
 *   - All icon and offline assets are served from cache immediately on subsequent
 *     launches (stale-while-revalidate), eliminating logo-fetch latency.
 *   - The /manifest.webmanifest is precached so the browser shows the correct
 *     splash/theme-color without a network request.
 *
 * Bump VERSION on each deploy that changes precached assets to drop old caches.
 */
const VERSION = 'v3';
const STATIC_CACHE = `zenova-static-${VERSION}`;
const PRECACHE = [
  '/offline.html',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
];

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
    url.pathname === '/manifest.webmanifest' ||
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

/* ==========================================================================
 * Real-time Native Push Notifications (WhatsApp / YouTube / Social standard)
 * Delivers instantly to phone lock screens, watches, and notification centers
 * even when the browser or PWA is completely closed.
 * ========================================================================== */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Zenova',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'Zenova';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    image: payload.image,
    tag: payload.tag || 'zenova-alert',
    renotify: true,
    vibrate: [120, 60, 120, 60, 200],
    data: {
      url: payload.url || (payload.data && payload.data.url) || '/',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open',
        title: 'View',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If an existing Zenova window is open, focus it and navigate
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // Otherwise, open a fresh window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Automatic token resync if browser rotates push subscription credentials
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((subscription) => {
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });
      })
      .catch(() => {
        /* best-effort resync */
      })
  );
});

