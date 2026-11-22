'use client';

import { useEffect } from 'react';

/**
 * Registers the offline service worker (public/sw.js). Production only — in dev a
 * caching worker fights Next's HMR. Renders nothing; the worker takes over on the
 * next load. Failures are swallowed: offline support is an enhancement, never a
 * hard dependency for the page to work.
 *
 * Also handles two edge-cases for returning users:
 *  1. The push subscription silently expired (browser rotated keys, user cleared
 *     site data, etc.) — resubscribes automatically if permission is already granted.
 *  2. The SW update path: notifies the new worker to skip waiting so users on a
 *     phone home screen get fresh assets on next launch without a manual refresh.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // In local development, unregister any service worker so it never intercepts
    // localhost requests or serves the offline fallback page.
    if (
      process.env.NODE_ENV !== 'production' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        })
        .catch(() => {});
      return;
    }

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        // Actively check for worker updates so returning phones get new assets immediately
        await reg.update();

        // Tell a waiting worker (new version) to activate immediately so the
        // updated service worker takes over without requiring a second reload.
        if (reg.waiting) {
          reg.waiting.postMessage('SKIP_WAITING');
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('SKIP_WAITING');
            }
          });
        });

        // Auto-resubscribe to push if the user already granted permission but
        // the subscription silently expired (happens after ~90 days on Chrome or
        // when the user clears browser data).
        if ('Notification' in window && Notification.permission === 'granted' && 'PushManager' in window) {
          const existing = await reg.pushManager.getSubscription();
          if (!existing) {
            // Subscription expired — silently resubscribe using the VAPID key
            // so the user doesn't miss push notifications without knowing why.
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (vapidKey) {
              try {
                const { urlBase64ToUint8Array } = await import('@/lib/push-client');
                const sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
                });
                // Register renewed subscription with the backend
                await fetch('/api/push/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    endpoint: sub.endpoint,
                    keys: sub.toJSON().keys,
                    userAgent: navigator.userAgent,
                  }),
                }).catch(() => {});
              } catch {
                /* best-effort — PushPromptModal will re-ask on next visit */
              }
            }
          }
        }
      } catch {}
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
