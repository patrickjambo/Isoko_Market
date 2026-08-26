import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Users,
  ShoppingBag,
  CreditCard,
  Briefcase,
  ShieldCheck,
  Flag,
  Activity,
} from 'lucide-react';
import { Radio } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { formatRWF, cn } from '@/lib/utils';
import { Sparkline, Trend } from '@/components/admin/sparkline';
import { AdminActivityTicker } from '@/components/admin/admin-activity-ticker';
import { getHealth } from '@/lib/metrics';
import { connectionCount } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const GOAL_USERS = 10_000;
const GOAL_TRANSACTIONS = 30_000;

function startOfDay(offsetDays = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function AdminOverviewPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');

  const today = startOfDay(0);
  const yesterday = startOfDay(1);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const weekUsers = await prisma.user.findMany({
    where: { createdAt: { gte: startOfDay(6) } },
    select: { createdAt: true },
  });

  const [
    users,
    newToday,
    newYesterday,
    dau,
    mau,
    listings,
    soldToday,
    flagged,
    jobs,
    txSuccess,
    revenueToday,
    pendingVerif,
    openReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: today } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: monthAgo } } }),
    prisma.listing.count({ where: { status: 'ACTIVE' } }),
    prisma.listing.count({ where: { status: 'SOLD', updatedAt: { gte: today } } }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
    prisma.job.count({ where: { status: 'OPEN' } }),
    prisma.transaction.count({ where: { status: 'SUCCESS' } }),
    prisma.transaction.aggregate({
      where: { status: 'SUCCESS', createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
  ]);

  // 7-day signup sparkline series.
  const series = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(6 - i);
    const next = startOfDay(5 - i);
    return weekUsers.filter((u) => u.createdAt >= day && (i === 6 || u.createdAt < next)).length;
  });

  const dauMau = mau ? Math.round((dau / mau) * 100) : 0;

  // System health from live in-process metrics (Section 2 — System Health card).
  const health = getHealth();
  const liveConnections = connectionCount();
  const healthStatus: 'green' | 'yellow' | 'red' =
    health.errorRate > 0.1 || health.p95 > 3000
      ? 'red'
      : health.errorRate > 0.02 || health.p95 > 1000
        ? 'yellow'
        : 'green';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('overviewSubtitle')}</p>
      </header>

      {/* Advanced cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card
          href="/admin/users"
          icon={Users}
          label={t('cardActiveUsers')}
          value={users.toLocaleString()}
          extra={
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                +{newToday} {t('today')} · DAU/MAU {dauMau}%
              </span>
              <Trend current={newToday} previous={newYesterday} />
            </div>
          }
          chart={<Sparkline data={series} className="h-8 w-full" />}
        />
        <Card
          href="/admin/verifications"
          icon={ShieldCheck}
          label={t('cardVerificationQueue')}
          value={pendingVerif.toLocaleString()}
          alert={pendingVerif > 5}
          extra={<span className="text-xs text-muted-foreground">{t('pendingReview')}</span>}
        />
        <Card
          href="/admin/moderation"
          icon={Flag}
          label={t('cardModeration')}
          value={openReports.toLocaleString()}
          alert={openReports > 0}
          extra={<span className="text-xs text-muted-foreground">{t('openReports')}</span>}
        />
        <Card
          href="/admin/listings"
          icon={ShoppingBag}
          label={t('cardListings')}
          value={listings.toLocaleString()}
          extra={
            <span className="text-xs text-muted-foreground">
              {soldToday} {t('soldToday')} · {flagged} {t('flaggedShort')}
            </span>
          }
        />
        <Card
          href="/admin/transactions"
          icon={CreditCard}
          label={t('cardTransactions')}
          value={formatRWF(revenueToday._sum.amount ?? 0, params.locale)}
          extra={
            <span className="text-xs text-muted-foreground">
              {t('revenueToday')} · {txSuccess} {t('allTime')}
            </span>
          }
        />
        <Card
          href="/admin/analytics"
          icon={Briefcase}
          label={t('cardJobs')}
          value={jobs.toLocaleString()}
          extra={<span className="text-xs text-muted-foreground">{t('openRoles')}</span>}
        />

        {/* System Health — live in-process metrics (Sentry corroborates in prod) */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Radio className="h-4 w-4" /> {t('cardHealth')}
            </span>
            <span
              className={cn(
                'h-3 w-3 rounded-full',
                healthStatus === 'green'
                  ? 'bg-success'
                  : healthStatus === 'yellow'
                    ? 'bg-accent'
                    : 'bg-destructive'
              )}
              title={healthStatus}
            />
          </div>
          <p className="text-2xl font-extrabold">{t(`health_${healthStatus}`)}</p>
          <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
            <span>
              {t('latency')}: <span className="font-semibold text-foreground">{health.p50}ms</span>
            </span>
            <span>
              {t('connections')}: <span className="font-semibold text-foreground">{liveConnections}</span>
            </span>
            <span>
              {t('errorRate')}: <span className="font-semibold text-foreground">{(health.errorRate * 100).toFixed(1)}%</span>
            </span>
          </div>
        </div>
      </div>

      {/* KPI goals + live activity */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 font-semibold">{t('kpiGoals')}</h2>
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <KpiBar label={t('metricUsers')} value={users} goal={GOAL_USERS} />
            <KpiBar label={t('metricTransactions')} value={txSuccess} goal={GOAL_TRANSACTIONS} />
          </div>
        </section>
        <div className="min-h-[220px]">
          <AdminActivityTicker />
        </div>
      </div>
    </div>
  );
}

function Card({
  href,
  icon: Icon,
  label,
  value,
  extra,
  chart,
  alert,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  extra?: React.ReactNode;
  chart?: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </span>
        {alert && <span className="h-2.5 w-2.5 rounded-full bg-destructive" />}
      </div>
      <p className="text-2xl font-extrabold">{value}</p>
      {chart}
      {extra}
    </Link>
  );
}

function KpiBar({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value.toLocaleString()} / {goal.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
