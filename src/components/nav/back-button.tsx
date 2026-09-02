'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';

// Bottom-nav tab homes — reachable in one tap from the tab bar, so no back
// button. Everything else (including dashboards, which are reached from the
// account menu) gets one.
const ROOTS = new Set(['/', '/marketplace', '/jobs', '/messages', '/profile']);

/**
 * One consistent back button for every sub-page. Hidden on the top-level homes.
 * Uses browser history so it returns wherever the user came from; `usePathname`
 * (next-intl) is already locale-stripped, so ROOTS matches clean paths.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('common');

  // Chat threads keep their own in-header back arrow.
  if (ROOTS.has(pathname) || pathname.startsWith('/messages/')) return null;

  return (
    <div className="container pt-3">
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
