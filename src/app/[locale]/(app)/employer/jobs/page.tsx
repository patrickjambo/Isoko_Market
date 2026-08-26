import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Briefcase, Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { HiringFunnel } from '@/components/employer/hiring-funnel';
import { EmployerJobActions } from '@/components/employer/employer-job-actions';
import { getCurrentUser } from '@/lib/auth';
import { getEmployerInsights } from '@/lib/employer-insights';

export const dynamic = 'force-dynamic';

/** Derived status chip: Open / Filled / Closed (§6). */
function chip(status: string, hired: number): { key: string; variant: 'success' | 'secondary' | 'muted' } {
  if (status === 'OPEN') return { key: 'chipOpen', variant: 'success' };
  if (hired > 0) return { key: 'chipFilled', variant: 'secondary' };
  return { key: 'chipClosed', variant: 'muted' };
}

export default async function MyJobsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('employer');

  const user = (await getCurrentUser())!;
  const { funnels } = await getEmployerInsights(user.id, user.isVerified);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">{t('myJobs')}</h1>
        <Button asChild variant="accent" size="sm">
          <Link href="/jobs/new">
            <Plus className="h-4 w-4" /> {t('postJob')}
          </Link>
        </Button>
      </div>

      {funnels.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={t('noJobs')}
          description={t('noJobsHint')}
          action={
            <Button asChild variant="accent">
              <Link href="/jobs/new">
                <Plus className="h-4 w-4" /> {t('postJob')}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {funnels.map((f) => {
            const c = chip(f.status, f.hired);
            return (
              <li key={f.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-start gap-2">
                  <Link href={`/jobs/${f.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium hover:text-primary">{f.title}</span>
                      <Badge variant={c.variant}>{t(c.key)}</Badge>
                      {f.newCount > 0 && f.status === 'OPEN' && (
                        <Badge variant="accent">{t('newBadge', { count: f.newCount })}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {f.type === 'GIG' ? t('typeGig') : t('typeJob')} · {t('viewsCount', { count: f.viewCount })}
                    </p>
                  </Link>
                  <EmployerJobActions jobId={f.id} status={f.status} />
                </div>
                <HiringFunnel applied={f.applied} shortlisted={f.shortlisted} hired={f.hired} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
