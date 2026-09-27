'use client';

import { useCallback, useRef } from 'react';
import type { RealtimeEvent } from '@/lib/realtime';
import { useRouter } from '@/i18n/routing';
import { useRealtime } from '@/hooks/use-realtime';

/**
 * Drop-in realtime updater for admin server-rendered pages: when any admin event
 * arrives over SSE, re-fetch the server components so lists/queues reflect the
 * change with no manual reload. Debounced to coalesce bursts of events.
 */
export function AdminLiveRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.type !== 'admin_event') return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    },
    [router]
  );

  useRealtime(onEvent);
  return null;
}
