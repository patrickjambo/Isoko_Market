'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/routing';

/**
 * Subscribes to a public item topic (`listing:<id>` / `job:<id>`) and refreshes
 * the current view when the item's status changes, so anyone *viewing* an item
 * sees "marked sold" / "position filled" live without a refresh (Section 9.1).
 * EventSource auto-reconnects, which is the polling fallback.
 */
export function LiveItemStatus({ topic }: { topic: string }) {
  const router = useRouter();
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const source = new EventSource(`/api/realtime/topic?name=${encodeURIComponent(topic)}`);
    source.onmessage = (e) => {
      if (!e.data) return;
      try {
        const event = JSON.parse(e.data) as { type: string; status?: string };
        // The topic already scopes to this item (the id is in the topic name),
        // so any entity_update on it is relevant.
        if (event.type === 'entity_update' && event.status !== lastStatus.current) {
          lastStatus.current = event.status ?? null;
          router.refresh();
        }
      } catch {
        /* ignore */
      }
    };
    return () => source.close();
  }, [topic, router]);

  return null;
}
