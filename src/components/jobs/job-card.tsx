import { MapPin, Briefcase, Sparkles } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { TrustBadge } from '@/components/trust/trust-badge';
import { formatRWF } from '@/lib/utils';
import type { MatchTier } from '@/lib/skills';

export type JobCardData = {
  id: string;
  title: string;
  type: 'JOB' | 'GIG';
  payMin: number | null;
  payMax: number | null;
  payPeriod: string | null;
  location: string;
  skills?: string[];
  createdAt?: Date | string;
  employer: { fullName: string; isVerified: boolean };
};

export function formatPay(
  job: Pick<JobCardData, 'payMin' | 'payMax' | 'payPeriod'>,
  locale: string,
  negotiable: string,
  periodLabel: (p: string) => string
): string {
  if (job.payMin == null && job.payMax == null) return negotiable;
  const lo = job.payMin != null ? formatRWF(job.payMin, locale) : null;
  const hi = job.payMax != null ? formatRWF(job.payMax, locale) : null;
  const range = lo && hi && lo !== hi ? `${lo} – ${hi}` : (lo ?? hi)!;
  const period = job.payPeriod ? ` / ${periodLabel(job.payPeriod)}` : '';
  return `${range}${period}`;
}

export function JobCard({ job, match }: { job: JobCardData; match?: MatchTier }) {
  const t = useTranslations('jobs');
  const tt = useTranslations('trust');
  const locale = useLocale();

  const pay = formatPay(job, locale, t('payNegotiable'), (p) => t(`form.period${cap(p)}`));

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-semibold leading-snug text-foreground group-hover:text-primary">
          {job.title}
        </h3>
        <Badge variant={job.type === 'GIG' ? 'accent' : 'secondary'} className="shrink-0">
          <Briefcase className="h-3 w-3" />
          {job.type === 'GIG' ? t('typeGig') : t('typeJob')}
        </Badge>
      </div>
      {match && match !== 'none' && (
        <span
          className={
            'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' +
            (match === 'strong'
              ? 'bg-success/15 text-success'
              : 'bg-accent/15 text-accent-foreground')
          }
        >
          <Sparkles className="h-3 w-3" />
          {match === 'strong' ? t('matchStrong') : t('matchGood')}
        </span>
      )}
      <p className="text-sm font-semibold text-primary">{pay}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {job.location}
        </span>
        <span className="inline-flex items-center gap-1 truncate">
          {job.employer.fullName}
          {job.employer.isVerified && (
            <TrustBadge variant="job" status="VERIFIED" verifiedLabel={tt('verifiedBadge')} />
          )}
        </span>
      </div>
    </Link>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
