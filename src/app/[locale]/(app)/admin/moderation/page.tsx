import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Flag } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { ReportActions } from '@/components/admin/report-actions';
import { prisma } from '@/lib/prisma';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ModerationPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');

  const reports = await prisma.report.findMany({
    where: { status: { in: ['OPEN', 'REVIEWING'] } },
    orderBy: { createdAt: 'desc' },
    include: { reportedBy: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('queueTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('moderationSubtitle')}</p>
      </header>

      {reports.length === 0 ? (
        <EmptyState icon={Flag} title={t('queueEmpty')} />
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <p className="font-semibold">
                  {r.targetType} · {r.reason}
                </p>
                {r.details && <p className="text-sm text-muted-foreground">{r.details}</p>}
                <p className="text-xs text-muted-foreground">
                  {t('reportedBy')} {r.reportedBy.fullName} · {timeAgo(r.createdAt, params.locale)}
                </p>
              </div>
              <ReportActions reportId={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
