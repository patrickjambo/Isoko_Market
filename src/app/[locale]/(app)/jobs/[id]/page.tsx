import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale, getLocale } from 'next-intl/server';
import { ChevronLeft, MapPin, Users, Wallet, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SellerTrustCard } from '@/components/trust/seller-trust-card';
import { ApplyButton } from '@/components/jobs/apply-button';
import { LiveItemStatus } from '@/components/shared/live-item-status';
import { MessageSellerButton } from '@/components/messaging/message-seller-button';
import { ContactLinks } from '@/components/shared/contact-links';
import { ReportDialog } from '@/components/trust/report-dialog';
import { formatPay } from '@/components/jobs/job-card';
import { getJob, getCvSkills } from '@/lib/queries';
import { asContact } from '@/lib/contact';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { timeAgo } from '@/lib/utils';
import { matchScore, labelForSkill } from '@/lib/skills';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('jobs');
  const tt = await getTranslations('trust');
  const tContact = await getTranslations('contact');
  const locale = await getLocale();

  const [job, user] = await Promise.all([getJob(params.id), getCurrentUser()]);
  if (!job) notFound();

  const isOwner = user?.id === job.employer.id;

  const [hasCv, existingApplication, ratingAgg, cvSkills] = await Promise.all([
    user
      ? prisma.cV.findUnique({ where: { userId: user.id }, select: { id: true } })
      : Promise.resolve(null),
    user
      ? prisma.application.findUnique({
          where: { jobId_applicantId: { jobId: job.id, applicantId: user.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.review.aggregate({ where: { revieweeId: job.employer.id }, _avg: { rating: true } }),
    user && !isOwner ? getCvSkills(user.id) : Promise.resolve([]),
  ]);

  const pay = formatPay(job, locale, t('payNegotiable'), (p) => t(`form.period${cap(p)}`));
  // "Why you match" — real overlap between the seeker's CV and this posting (§5).
  const match = matchScore(cvSkills, job.skills);

  // Count the view (non-owner) — feeds the employer performance rule engine (§2).
  if (user && !isOwner) {
    void prisma.job.update({ where: { id: job.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  }

  return (
    <div className="container max-w-4xl py-6">
      <LiveItemStatus topic={`job:${job.id}`} />
      <Link
        href="/jobs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t('title')}
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-5 md:col-span-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={job.type === 'GIG' ? 'accent' : 'secondary'}>
                {job.type === 'GIG' ? t('typeGig') : t('typeJob')}
              </Badge>
              {job.status === 'CLOSED' && <Badge variant="muted">{t('closeJob')}</Badge>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-4 w-4" /> {pay}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {job.location}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" /> {t('applicants', { count: job._count.applications })}
              </span>
              <span>{timeAgo(job.createdAt, locale)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isOwner ? (
              <Button asChild>
                <Link href={`/jobs/${job.id}/applicants`}>
                  <Users className="h-4 w-4" /> {t('manageApplicants')}
                </Link>
              </Button>
            ) : (
              <>
                <ApplyButton
                  jobId={job.id}
                  hasCv={Boolean(hasCv)}
                  alreadyApplied={Boolean(existingApplication)}
                />
                <MessageSellerButton
                  jobId={job.id}
                  label={t('title')}
                  variant="outline"
                />
                <ReportDialog targetType="JOB" targetId={job.id} label={tt('reportJob')} />
              </>
            )}
          </div>

          {/* Why you match — surfaces the specific overlapping skills (§5). */}
          {!isOwner && job.skills.length > 0 && match.overlap.length > 0 && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-success">
                <Sparkles className="h-4 w-4" />
                {match.tier === 'strong' ? t('matchStrong') : t('matchGood')} · {t('whyYouMatch')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {match.overlap.map((k) => (
                  <Badge key={k} variant="success">
                    {labelForSkill(k, locale)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {job.skills.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t('requiredSkills')}</p>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((k) => {
                  const have = match.overlap.includes(k);
                  return (
                    <Badge key={k} variant={have ? 'success' : 'secondary'}>
                      {labelForSkill(k, locale)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
            {job.description}
          </div>

          {/* Extra contact the employer added — tap-to-call / WhatsApp / email / IG. */}
          {asContact(job.contactInfo) && (
            <div className="mt-3 space-y-1.5">
              <p className="text-sm font-semibold">{tContact('title')}</p>
              <ContactLinks contact={asContact(job.contactInfo)} />
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <SellerTrustCard
            person={job.employer}
            rating={ratingAgg._avg.rating ?? 0}
            reviewCount={0}
            itemCount={job._count.applications}
            itemCountLabel={t('applicants', { count: job._count.applications })}
            locale={params.locale}
          />
        </div>
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
