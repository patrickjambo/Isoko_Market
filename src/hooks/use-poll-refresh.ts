'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';

/**
 * Visibility-aware polling refresh — re-fetches the current route's server data
 * every `intervalMs` while the tab is visible, then pauses when it's hidden.
 *
 * This is the serverless-safe path for live updates. The SSE realtime bus is an
 * in-process EventEmitter (src/lib/realtime.ts), so on a multi-instance host
 * like Vercel an event published by one user's request (a hirer shortlisting, a
 * buyer confirming an order) lands on a DIFFERENT function instance than the one
 * holding the viewer's SSE connection — it never arrives. Polling guarantees the
 * UI updates on its own, no manual refresh. Runs alongside SSE (which still gives
 * instant updates locally / when both ends share an instance), so it's a
 * belt-and-suspenders fallback, not a replacement.
 */
export function usePollRefresh(intervalMs = 5000): void {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let id: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const start = () => {
      if (id == null) id = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'visible') start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router, intervalMs]);
}
