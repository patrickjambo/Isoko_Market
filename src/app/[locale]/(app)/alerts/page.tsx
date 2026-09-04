import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BellRing, Plus } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { PollRefresh } from '@/components/shared/poll-refresh';
import { AlertList } from '@/components/marketplace/alert-list';
import { getCurrentUser } from '@/lib/auth';
import { getCategories } from '@/lib/queries';
import { prisma } from '@/lib/prisma';
import { categoryName } from '@/lib/i18n-helpers';

export const dynamic = 'force-dynamic';

export default async function AlertsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('marketplace');
  const tcond = await getTranslations('marketplace.condition');
  const [alerts, categories] = await Promise.all([
    prisma.savedSearch.findMany({
      where: { userId: user.id, kind: 'LISTING' },
      orderBy: { createdAt: 'desc' },
    }),
    getCategories(),
  ]);
  const catName = (id: string | null) =>
    id ? categoryName(categories.find((c) => c.id === id), params.locale) : '';

  const price = (min: number | null, max: number | null) => {
    const fmt = (n: number) => n.toLocaleString();
    if (min != null && max != null) return t('priceBetween', { min: fmt(min), max: fmt(max) });
    if (max != null) return t('priceUnder', { max: fmt(max) });
    if (min != null) return t('priceOver', { min: fmt(min) });
    return '';
  };

  const rows = alerts.map((a) => ({
    id: a.id,
    label: a.label,
    summary:
      [
        a.q,
        catName(a.categoryId),
        a.condition ? tcond(a.condition) : '',
        a.location,
        price(a.minPrice, a.maxPrice),
      ]
        .filter(Boolean)
        .join(' · ') || t('anyPrice'),
  }));

  return (
    <div className="container max-w-2xl py-6">
      {/* Deletions and new alerts reflect live. */}
      <PollRefresh intervalMs={15000} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('alertsTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('alertsSubtitle')}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/marketplace">
            <Plus className="h-4 w-4" /> {t('title')}
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={BellRing} title={t('alertsEmpty')} />
      ) : (
        <AlertList alerts={rows} />
      )}
    </div>
  );
}
