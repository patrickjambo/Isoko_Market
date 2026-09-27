import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Briefcase, Users, Sparkles, Lock, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { JobActions } from '@/components/admin/job-actions';
import { AdminLiveRefresh } from '@/components/admin/admin-live-refresh';
import { prisma } from '@/lib/prisma';
import { timeAgo, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Filter = 'OPEN' | 'CLOSED' | undefined;

export default async function AdminJobsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { status?: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');

  const filter: Filter =
    searchParams.status === 'OPEN' ? 'OPEN' : searchParams.status === 'CLOSED' ? 'CLOSED' : undefined;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [openCount, closedCount, applications, newToday, jobs] = await Promise.all([
    prisma.job.count({ where: { status: 'OPEN' } }),
    prisma.job.count({ where: { status: 'CLOSED' } }),
    prisma.application.count(),
    prisma.job.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.job.findMany({
      where: filter ? { status: filter } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        type: true,
        location: true,
        status: true,
        viewCount: true,
        createdAt: true,
        employer: { select: { fullName: true } },
        _count: { select: { applications: true } },
      },
    }),
  ]);

  const stats: { icon: LucideIcon; value: number; label: string }[] = [
    { icon: Briefcase, value: openCount, label: t('statOpenJobs') },
    { icon: Users, value: applications, label: t('statApplications') },
    { icon: Sparkles, value: newToday, label: t('statNewToday') },
    { icon: Lock, value: closedCount, label: t('statClosedJobs') },
  ];

  const tabs: { key: Filter; label: string }[] = [
    { key: undefined, label: t('filterAll') },
    { key: 'OPEN', label: t('filterOpen') },
    { key: 'CLOSED', label: t('filterClosed') },
  ];

  return (
    <div className="space-y-5">
      {/* New jobs + status changes stream in without a refresh. */}
      <AdminLiveRefresh />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('jobsTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('jobsSubtitle')}</p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-extrabold tracking-tight">{s.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <Link
              key={tab.label}
              href={tab.key ? `/admin/jobs?status=${tab.key}` : '/admin/jobs'}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-secondary text-primary'
                  : 'border-border bg-background hover:bg-secondary'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title={t('jobsEmpty')} />
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <li
              key={j.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/jobs/${j.id}`} className="truncate font-semibold hover:underline">
                    {j.title}
                  </Link>
                  <Badge variant={j.type === 'GIG' ? 'secondary' : 'muted'}>
                    {j.type === 'GIG' ? t('typeGig') : t('typeJob')}
                  </Badge>
                  <Badge variant={j.status === 'OPEN' ? 'success' : 'muted'}>
                    {j.status === 'OPEN' ? t('filterOpen') : t('filterClosed')}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {[j.employer.fullName, j.location, timeAgo(j.createdAt, params.locale)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1" title={t('statApplications')}>
                  <Users className="h-4 w-4" /> {j._count.applications}
                </span>
                <span className="flex items-center gap-1" title={t('colViews')}>
                  <Eye className="h-4 w-4" /> {j.viewCount}
                </span>
              </div>

              <JobActions jobId={j.id} status={j.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
