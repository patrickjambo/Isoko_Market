import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShoppingBag, Briefcase, Users, Compass, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

/**
 * The critical fork (Visitor spec §3): one screen, four large tappable cards —
 * no dropdown, no text field. Choosing routes into the right onboarding path but
 * never locks the person in; every account can use marketplace and jobs later.
 */
export default function GetStartedPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { returnTo?: string };
}) {
  setRequestLocale(params.locale);
  return <Content locale={params.locale} returnTo={searchParams.returnTo} />;
}

async function Content({ locale, returnTo }: { locale: string; returnTo?: string }) {
  const t = await getTranslations('onboarding');
  const ret = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : '';

  const cards: { intent: string; href: string; icon: LucideIcon; accent: string }[] = [
    { intent: 'buy_sell', href: `/register?intent=buy_sell${ret}`, icon: ShoppingBag, accent: 'text-primary bg-primary/10' },
    { intent: 'find_work', href: `/register?intent=find_work${ret}`, icon: Briefcase, accent: 'text-accent bg-accent/10' },
    { intent: 'hire', href: `/register?intent=hire${ret}`, icon: Users, accent: 'text-primary bg-primary/10' },
    // "Just looking" drops straight into browse — intent inferred later (§3).
    { intent: 'browse', href: returnTo || '/marketplace', icon: Compass, accent: 'text-muted-foreground bg-secondary' },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t('forkTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('forkSubtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.intent}
              href={c.href}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c.accent}`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-semibold">
                  {t(`intent_${c.intent}_title`)}
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="block text-sm text-muted-foreground">{t(`intent_${c.intent}_body`)}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">{t('notLockedIn')}</p>

      <p className="text-center text-sm text-muted-foreground">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('logIn')}
        </Link>
      </p>
    </div>
  );
}
