import { getTranslations } from 'next-intl/server';
import { ShoppingCart, Handshake, Home, Briefcase } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * "Connect · Trade · Hire · Grow" — the four things you can do on Zenova, as
 * tappable entry points. Recreated from the brand banner as live components.
 */
export async function ConnectTradeGrow() {
  const t = await getTranslations('home');

  const cards = [
    {
      icon: ShoppingCart,
      ring: 'bg-emerald-600',
      title: t('cardBuyTitle'),
      desc: t('cardBuyDesc'),
      href: '/marketplace',
    },
    {
      icon: Handshake,
      ring: 'bg-sky-600',
      title: t('cardHireTitle'),
      desc: t('cardHireDesc'),
      href: '/jobs',
    },
    {
      icon: Home,
      ring: 'bg-amber-500',
      title: t('cardRentTitle'),
      desc: t('cardRentDesc'),
      href: '/marketplace?kind=SERVICE',
    },
    {
      icon: Briefcase,
      ring: 'bg-violet-600',
      title: t('cardJobsTitle'),
      desc: t('cardJobsDesc'),
      href: '/jobs',
    },
  ];

  return (
    <section className="container py-14">
      {/* Connect · Trade · Hire · Grow */}
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          <span>{t('ctgConnect')}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          <span>{t('ctgTrade')}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span>{t('ctgHire')}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>{t('ctgGrow')}</span>
        </h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {t('ctgTagline')}
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              href={c.href}
              className="group flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <span
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-sm transition-transform duration-200 group-hover:scale-105',
                  c.ring
                )}
              >
                <Icon className="h-8 w-8" />
              </span>
              <h3 className="mt-4 font-bold text-foreground">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
