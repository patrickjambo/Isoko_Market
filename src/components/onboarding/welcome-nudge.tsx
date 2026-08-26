'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

const KEY = 'isoko_welcome_dismissed';

const PATH: Record<string, { href: string }> = {
  buy_sell: { href: '/dashboard/sell' },
  find_work: { href: '/cv' },
  hire: { href: '/jobs/new' },
  browse: { href: '/marketplace' },
};

/**
 * One-time, dismissible welcome nudge (Visitor spec §6) — highlights the single
 * primary action for the path the user chose at sign-up, never a forced multi-
 * screen tour. Remembers dismissal in localStorage so it shows only once.
 */
export function WelcomeNudge({ preferredRole, name }: { preferredRole: string | null; name: string }) {
  const t = useTranslations('onboarding');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (preferredRole && PATH[preferredRole] && localStorage.getItem(KEY) !== '1') setShow(true);
  }, [preferredRole]);

  if (!show || !preferredRole || !PATH[preferredRole]) return null;

  function dismiss() {
    localStorage.setItem(KEY, '1');
    setShow(false);
  }

  return (
    <div className="container pt-4">
      <div className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t('welcomeGreeting', { name })}</p>
          <p className="text-sm text-muted-foreground">{t(`welcome_${preferredRole}`)}</p>
          <Link
            href={PATH[preferredRole]!.href}
            onClick={dismiss}
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            {t(`cta_${preferredRole}`)} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
