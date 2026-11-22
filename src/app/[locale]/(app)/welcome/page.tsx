'use client';

import { useState } from 'react';
import { ShoppingBag, Briefcase, Users, Compass, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useFeatureFlags } from '@/components/providers/feature-flags-provider';

/**
 * Google-auth onboarding: shown once to brand-new Google users so they can
 * choose their initial intent, exactly like the /get-started fork for OTP users.
 * Uses /api/account/set-intent to persist the choice then redirects.
 * Client component so it reacts to real-time feature-flag changes immediately.
 */
export default function WelcomePage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const flags = useFeatureFlags();
  const [loading, setLoading] = useState<string | null>(null);

  const allCards = [
    {
      intent: 'buy_sell',
      icon: ShoppingBag,
      accent: 'text-primary bg-primary/10',
      enabled: true,
    },
    {
      intent: 'find_work',
      icon: Briefcase,
      accent: 'text-accent bg-accent/10',
      enabled: flags.jobsEnabled || flags.cvBuilderEnabled,
    },
    {
      intent: 'hire',
      icon: Users,
      accent: 'text-primary bg-primary/10',
      enabled: flags.hiringEnabled,
    },
    {
      intent: 'browse',
      icon: Compass,
      accent: 'text-muted-foreground bg-secondary',
      enabled: true,
    },
  ].filter((c) => c.enabled);

  async function choose(intent: string) {
    if (loading) return;
    setLoading(intent);
    try {
      const res = await fetch('/api/account/set-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent }),
      });
      const data = await res.json();
      const redirectTo: string = res.ok && data?.redirectTo ? data.redirectTo : '/';
      router.push(redirectTo as Parameters<typeof router.push>[0]);
    } catch {
      // On error, still navigate to home
      router.push('/');
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t('googleWelcomeTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('googleWelcomeSubtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {allCards.map((c) => {
          const Icon = c.icon;
          const isLoading = loading === c.intent;
          return (
            <button
              key={c.intent}
              type="button"
              onClick={() => choose(c.intent)}
              disabled={!!loading}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c.accent}`}
              >
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Icon className="h-6 w-6" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-semibold">
                  {t(`intent_${c.intent}_title`)}
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="block text-sm text-muted-foreground">
                  {t(`intent_${c.intent}_body`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">{t('notLockedIn')}</p>
    </div>
  );
}
