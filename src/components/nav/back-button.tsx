'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';

// Mobile bottom-nav tab homes: on mobile they're one tap away in the tab bar, so
// a back button is redundant there — but the tab bar is `md:hidden`, so on
// DESKTOP these pages (e.g. Messages, Profile) would otherwise have no way back.
// Hence: render the back button but hide it on mobile only for these.
const TAB_HOMES = new Set(['/marketplace', '/jobs', '/messages', '/profile']);

/**
 * One consistent back button for every sub-page (including dashboards). Uses
 * browser history so it returns wherever the user came from; `usePathname`
 * (next-intl) is already locale-stripped, so the path sets match clean paths.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('common');

  // The site root has nowhere to go back to; chat threads keep their own
  // in-header back arrow.
  if (pathname === '/' || pathname.startsWith('/messages/')) return null;

  const tabHome = TAB_HOMES.has(pathname);

  return (
    <div className={cn('container pt-3', tabHome && 'hidden md:block')}>
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </button>
    </div>
  );
}
