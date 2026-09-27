import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LifeBuoy, Inbox, Clock, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { AdminLiveRefresh } from '@/components/admin/admin-live-refresh';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { effectivePermissions } from '@/lib/permissions';
import { timeAgo, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Filter = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED' | undefined;

const STATUS_VARIANT: Record<string, 'success' | 'muted' | 'secondary' | 'destructive'> = {
  OPEN: 'secondary',
  PENDING: 'muted',
  RESOLVED: 'success',
  CLOSED: 'muted',
};
const PRIORITY_VARIANT: Record<string, 'destructive' | 'secondary' | 'muted'> = {
  HIGH: 'destructive',
  NORMAL: 'secondary',
  LOW: 'muted',
};

export default async function AdminSupportPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { status?: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user || !(await effectivePermissions(user)).has('support.view')) notFound();
  const t = await getTranslations('support');
  const ta = await getTranslations('admin');

  const raw = searchParams.status?.toUpperCase();
  const filter: Filter =
    raw === 'OPEN' || raw === 'PENDING' || raw === 'RESOLVED' || raw === 'CLOSED' ? raw : undefined;

  const [open, pending, resolved, high, tickets] = await Promise.all([
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'PENDING' } }),
    prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
    prisma.supportTicket.count({ where: { priority: 'HIGH', status: { in: ['OPEN', 'PENDING'] } } }),
    prisma.supportTicket.findMany({
      where: filter ? { status: filter } : {},
      orderBy: [{ status: 'asc' }, { lastReplyAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        category: true,
        lastReplyAt: true,
        user: { select: { fullName: true } },
      },
    }),
  ]);

  const stats: { icon: LucideIcon; value: number; label: string }[] = [
    { icon: Inbox, value: open, label: t('status_OPEN') },
    { icon: Clock, value: pending, label: t('status_PENDING') },
    { icon: CheckCircle2, value: resolved, label: t('status_RESOLVED') },
    { icon: AlertTriangle, value: high, label: t('highPriority') },
  ];

  const tabs: { key: Filter; label: string }[] = [
    { key: undefined, label: ta('filterAll') },
    { key: 'OPEN', label: t('status_OPEN') },
    { key: 'PENDING', label: t('status_PENDING') },
    { key: 'RESOLVED', label: t('status_RESOLVED') },
    { key: 'CLOSED', label: t('status_CLOSED') },
  ];

  return (
    <div className="space-y-5">
      <AdminLiveRefresh />
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('adminTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('adminSubtitle')}</p>
      </header>

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

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <Link
              key={tab.label}
              href={tab.key ? `/admin/support?status=${tab.key}` : '/admin/support'}
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

      {tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title={t('queueEmpty')} />
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/admin/support/${ticket.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{ticket.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      ticket.user.fullName,
                      t(`category_${ticket.category}`),
                      timeAgo(ticket.lastReplyAt, params.locale),
                    ].join(' · ')}
                  </p>
                </div>
                {ticket.priority === 'HIGH' && (
                  <Badge variant={PRIORITY_VARIANT.HIGH}>{t('priority_HIGH')}</Badge>
                )}
                <Badge variant={STATUS_VARIANT[ticket.status] ?? 'muted'}>
                  {t(`status_${ticket.status}`)}
                </Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
