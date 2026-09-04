'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useRealtime } from '@/hooks/use-realtime';

/**
 * Live unread badge. Two paths, belt-and-suspenders:
 *  - SSE (useRealtime) delivers instantly when the viewer and the publisher
 *    share a server instance.
 *  - A visibility-aware poll of /api/notifications/unread catches everything
 *    else — on Vercel the in-memory SSE bus can't cross instances, so without
 *    this the badge would sit stale until a full reload. Polling makes new
 *    notifications (order intents, saved-search matches, …) appear on their own.
 */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const t = useTranslations('nav');
  const { toast } = useToast();
  const [unread, setUnread] = useState(initialUnread);
  const unreadRef = useRef(initialUnread);
  unreadRef.current = unread;

  useRealtime((event) => {
    if (event.type === 'notification') {
      setUnread((n) => n + 1);
      toast(event.notification.title, 'info');
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let id: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/notifications/unread', { cache: 'no-store' });
        if (!res.ok) return;
        const { data } = await res.json();
        const next = Number(data?.unread ?? 0);
        // Surface a toast only when the poll discovers a NEW one (the SSE path
        // already toasts locally; on Vercel it won't, so this covers it).
        if (next > unreadRef.current) toast(t('notifications'), 'info');
        setUnread(next);
      } catch {
        /* transient — try again next tick */
      }
    };
    const start = () => {
      if (id == null) id = setInterval(tick, 10000);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void tick(); // reconcile immediately on return, no wait
        start();
      } else stop();
    };

    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'visible') start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [toast, t]);

  return (
    <Button variant="ghost" size="icon" asChild aria-label={t('notifications')}>
      <Link href="/notifications" className="relative" onClick={() => setUnread(0)}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
