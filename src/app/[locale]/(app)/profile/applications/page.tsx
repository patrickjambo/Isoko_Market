import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FileText, MapPin, Send, Eye, Star, CalendarClock, CheckCircle2, X, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ApplicationStatus } from '@prisma/client';
import { Link, redirect } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { LiveApplications } from '@/components/jobs/live-applications';
import { WithdrawApplicationButton } from '@/components/jobs/withdraw-application-button';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const statusVariant: Record<ApplicationStatus, 'muted' | 'secondary' | 'success' | 'destructive' | 'accent'> = {
  APPLIED: 'secondary',
  VIEWED: 'muted',
  SHORTLISTED: 'accent',
  INTERVIEW: 'accent',
  HIRED: 'success',
  REJECTED: 'destructive',
  POSITION_FILLED: 'muted',
};

// Distinct icon per stage so "Shortlisted" / "Interview" stand out from "Viewed".
const statusIcon: Record<ApplicationStatus, LucideIcon> = {
  APPLIED: Send,
  VIEWED: Eye,
  SHORTLISTED: Star,
  INTERVIEW: CalendarClock,
  HIRED: CheckCircle2,
  REJECTED: X,
  POSITION_FILLED: Users,
};

// The linear hiring stepper, for a compact "how far along" cue.
const STAGES: ApplicationStatus[] = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW', 'HIRED'];

export default async function MyApplicationsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('profile');
  const ts = await getTranslations('jobs.status');

  const applications = await prisma.application.findMany({
    where: { applicantId: user.id },
    orderBy: { appliedAt: 'desc' },
    include: { job: { select: { id: true, title: true, location: true } } },
  });

  return (
    <div className="container max-w-2xl py-6">
      {/* Live status updates land the moment an employer acts (Part 8 / DoD #5). */}
      <LiveApplications />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t('myApplications')}</h1>

      {applications.length === 0 ? (
        <EmptyState icon={FileText} title={t('myApplications')} description={t('noApplicationsHint')} />
      ) : (
        <ul className="space-y-3">
          {applications.map((app) => {
            const Icon = statusIcon[app.status];
            const stageIdx = STAGES.indexOf(app.status);
            const shortlisted = app.status === 'SHORTLISTED' || app.status === 'INTERVIEW';
            // A seeker can withdraw while the application is still active (not
            // after being hired, rejected, or moved to position-filled).
            const canWithdraw =
              app.status === 'APPLIED' ||
              app.status === 'VIEWED' ||
              app.status === 'SHORTLISTED' ||
              app.status === 'INTERVIEW';
            return (
              <li
                key={app.id}
                className={
                  'overflow-hidden rounded-xl border bg-card ' +
                  (shortlisted ? 'border-accent/50 ring-1 ring-accent/30' : 'border-border')
                }
              >
                <Link
                  href={`/jobs/${app.job.id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{app.job.title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {app.job.location} ·{' '}
                      {timeAgo(app.appliedAt, params.locale)}
                    </p>
                    {/* Compact stepper: filled dots up to the current stage. */}
                    {stageIdx >= 0 && (
                      <div className="mt-1.5 flex items-center gap-1" aria-hidden>
                        {STAGES.map((_, i) => (
                          <span
                            key={i}
                            className={
                              'h-1.5 rounded-full transition-all ' +
                              (i <= stageIdx ? 'w-5 bg-accent' : 'w-2.5 bg-muted')
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant={statusVariant[app.status]} className="shrink-0">
                    <Icon className="h-3.5 w-3.5" /> {ts(app.status)}
                  </Badge>
                </Link>
                {canWithdraw && (
                  <div className="flex justify-end border-t border-border px-4 py-1.5">
                    <WithdrawApplicationButton applicationId={app.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
