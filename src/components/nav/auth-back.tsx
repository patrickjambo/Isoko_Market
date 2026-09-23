'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

/**
 * Back control for the auth/onboarding pages (which sit outside the app shell's
 * BackButton). Returns to the previous page, or home if the page was opened
 * directly (e.g. from an email link) so it never dead-ends off the site.
 */
export function AuthBack() {
  const router = useRouter();
  const t = useTranslations('common');

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push('/');
      }}
      aria-label={t('back')}
      className="inline-flex items-center gap-1 rounded-lg p-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
