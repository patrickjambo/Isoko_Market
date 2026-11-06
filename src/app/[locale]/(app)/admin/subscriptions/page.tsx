import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { effectivePermissions } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getPlatformSettings } from '@/lib/commission';
import { AdminSubscriptions } from '@/components/admin/admin-subscriptions';

export const dynamic = 'force-dynamic';

export default async function AdminSubscriptionsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user || !(await effectivePermissions(user)).has('users.view')) notFound();

  const t = await getTranslations('subscription');

  const [settings, sellers, activeCount, revenueAgg, expiringSoon] = await Promise.all([
    getPlatformSettings(),
    prisma.user.findMany({
      where: {
        subscriptionStatus: { not: 'NONE' },
      },
      orderBy: { subscriptionExpiresAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: { subscriptionStatus: 'ACTIVE' } }),
    prisma.transaction.aggregate({
      where: { type: 'SUBSCRIPTION', status: 'SUCCESS' },
      _sum: { amount: true },
    }),
    prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    }),
  ]);

  const totalRevenue = revenueAgg._sum.amount ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('adminPanelTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('adminPanelSubtitle')}</p>
      </header>

      <AdminSubscriptions
        sellers={sellers.map((s) => ({
          id: s.id,
          fullName: s.fullName,
          email: s.email ?? '',
          subscriptionStatus: s.subscriptionStatus,
          subscriptionPlan: s.subscriptionPlan ?? null,
          subscriptionExpiresAt: s.subscriptionExpiresAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
        }))}
        stats={{
          totalActive: activeCount,
          totalRevenue,
          expiringSoon,
        }}
        subscriptionEnabled={settings.subscriptionEnabled}
      />
    </div>
  );
}
