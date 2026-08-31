'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import { usePollRefresh } from '@/hooks/use-poll-refresh';

/**
 * Subscribes to a public item topic (`listing:<id>` / `job:<id>` / `order:<id>`)
 * and refreshes the current view when the item's status changes, so anyone
 * *viewing* an item sees "marked sold" / "position filled" / "payment confirmed"
 * live without a refresh (Section 9.1).
 *
 * SSE gives the instant update; usePollRefresh is the serverless fallback for
 * Vercel, where the in-memory bus can't deliver an event published by the other
 * party's request to this viewer's connection.
 */
export function LiveItemStatus({ topic }: { topic: string }) {
  const router = useRouter();
  const lastStatus = useRef<string | null>(null);
  usePollRefresh(5000);

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
