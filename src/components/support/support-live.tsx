'use client';

import { useCallback, useRef } from 'react';
import type { RealtimeEvent } from '@/lib/realtime';
import { useRouter } from '@/i18n/routing';
import { useRealtime } from '@/hooks/use-realtime';

/**
 * Keeps a support view current in realtime: refreshes the server components when
 * a notification (user side) or admin event (staff side) arrives. Debounced.
 */
export function SupportLive() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.type !== 'notification' && event.type !== 'admin_event') return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    },
    [router]
  );

  useRealtime(onEvent);
  return null;
}
