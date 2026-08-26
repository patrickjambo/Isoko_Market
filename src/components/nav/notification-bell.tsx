'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useRealtime } from '@/hooks/use-realtime';

/** Live unread badge; increments via SSE without any page refresh (Section 9.1). */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const t = useTranslations('nav');
  const { toast } = useToast();
  const [unread, setUnread] = useState(initialUnread);

  useRealtime((event) => {
    if (event.type === 'notification') {
      setUnread((n) => n + 1);
      toast(event.notification.title, 'info');
    }
  });

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
