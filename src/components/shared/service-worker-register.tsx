'use client';

import { useEffect } from 'react';

/**
 * Registers the offline service worker (public/sw.js). Production only — in dev a
 * caching worker fights Next's HMR. Renders nothing; the worker takes over on the
 * next load. Failures are swallowed: offline support is an enhancement, never a
 * hard dependency for the page to work.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        // Actively check for worker updates so returning phones get new assets immediately
        await reg.update();
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
