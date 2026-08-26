'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeEvent } from '@/lib/realtime';

/**
 * Subscribe to the server-sent realtime stream (Section 9.1). Automatically
 * reconnects (EventSource does this natively), which doubles as the "polling
 * fallback if the socket drops" requirement. Only runs for logged-in users.
 */
export function useRealtime(
  onEvent: (event: RealtimeEvent) => void,
  enabled = true
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const source = new EventSource('/api/realtime');
    source.onmessage = (e) => {
      if (!e.data) return;
      try {
        handlerRef.current(JSON.parse(e.data) as RealtimeEvent);
      } catch {
        /* ignore malformed frames */
      }
    };
    // EventSource retries on error by default; nothing to do here.
    return () => source.close();
  }, [enabled]);
}
