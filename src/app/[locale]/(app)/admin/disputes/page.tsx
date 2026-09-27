import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Scale, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { EmptyState } from '@/components/shared/empty-state';
import { AdminLiveRefresh } from '@/components/admin/admin-live-refresh';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { effectivePermissions } from '@/lib/permissions';
import { formatRWF, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminDisputesPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user || !(await effectivePermissions(user)).has('moderation.view')) notFound();
  const t = await getTranslations('admin');

  const disputes = await prisma.order.findMany({
    where: { status: 'DISPUTED' },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      amount: true,
      updatedAt: true,
      listing: { select: { title: true } },
      buyer: { select: { fullName: true } },
      seller: { select: { fullName: true } },
    },
  });

  return (
    <div className="space-y-5">
      <AdminLiveRefresh />
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('disputesTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('disputesSubtitle')}</p>
      </header>

      {disputes.length === 0 ? (
        <EmptyState icon={Scale} title={t('disputesEmpty')} />
      ) : (
        <ul className="space-y-2">
          {disputes.map((d) => (
            <li key={d.id}>
              <Link
                href={`/admin/disputes/${d.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.listing.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t('disputeParties', { buyer: d.buyer.fullName, seller: d.seller.fullName })} ·{' '}
                    {timeAgo(d.updatedAt, params.locale)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold">{formatRWF(d.amount)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
