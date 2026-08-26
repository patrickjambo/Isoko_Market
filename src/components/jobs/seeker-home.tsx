import { getTranslations } from 'next-intl/server';
import { FileText, Sparkles, Clock, ArrowRight, ListChecks, Rocket } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { JobCard } from '@/components/jobs/job-card';
import { getSeekerHome } from '@/lib/queries';
import { matchScore } from '@/lib/skills';

/**
 * Job Seeker home (§2) — shown above the job feed for signed-in seekers:
 * CV Completeness, Application Status, a single Boost-Your-Profile nudge,
 * skill-matched "Recommended for You" and time-sensitive "Nearby Gigs Today".
 * Every card is driven by real data (match badges reflect true CV↔job overlap).
 */
export async function SeekerHome({
  userId,
  location,
}: {
  userId: string;
  location?: string | null;
}) {
  const t = await getTranslations('jobs');
  const { skills, completeness, statusCounts, recommended, nearbyGigs } = await getSeekerHome(
    userId,
    location
  );

  const STAGES = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW', 'HIRED'] as const;
  const totalApplied = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="mb-6 space-y-6">
      {/* Top row: CV completeness + application status */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* CV Completeness */}
        <Link
          href="/cv"
          className="group flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" /> {t('cvCompleteness')}
            </span>
            <span className="text-sm font-bold text-primary">{completeness.percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${completeness.percent}%` }}
            />
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
            {completeness.percent >= 100
              ? t('cvComplete')
              : completeness.nextStep
                ? t('cvNextStep', { step: t(`boostStep_${completeness.nextStep}`) })
                : t('cvKeepGoing')}
            <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        {/* Application Status */}
        <Link
          href="/profile/applications"
          className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="h-4 w-4 text-primary" /> {t('applicationStatus')}
          </span>
          {totalApplied === 0 ? (
            <p className="text-xs text-muted-foreground">{t('noApplicationsYet')}</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {STAGES.map((s) => (
                <span key={s} className="text-xs text-muted-foreground">
                  <span className="text-base font-bold text-foreground">{statusCounts[s] ?? 0}</span>{' '}
                  {t(`status.${s}`)}
                </span>
              ))}
            </div>
          )}
        </Link>
      </div>

      {/* Boost your profile — single most impactful next step (§2, not a dump) */}
      {completeness.nextStep && completeness.percent < 100 && (
        <Link
          href="/cv"
          className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm hover:bg-accent/10"
        >
          <Rocket className="h-5 w-5 shrink-0 text-accent-foreground" />
          <span className="flex-1">
            <span className="font-semibold">{t('boostProfile')}</span>{' '}
            <span className="text-muted-foreground">
              {t(`boostNudge_${completeness.nextStep}`)}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* Recommended for you — skill-matched, with real match badges */}
      {recommended.length > 0 && (
        <section>
          <SectionHeader icon={Sparkles} title={t('recommendedForYou')} />
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {recommended.map((job) => (
              <div key={job.id} className="w-64 shrink-0">
                <JobCard job={job} match={matchScore(skills, job.skills ?? []).tier} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Nearby gigs today — time-sensitive short-term work */}
      {nearbyGigs.length > 0 && (
        <section>
          <SectionHeader icon={Clock} title={t('nearbyGigsToday')} />
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {nearbyGigs.map((job) => (
              <div key={job.id} className="w-64 shrink-0">
                <JobCard job={job} match={matchScore(skills, job.skills ?? []).tier} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Clock; title: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
      <Icon className="h-5 w-5 text-primary" /> {title}
    </h2>
  );
}
