import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Briefcase, Users, Wallet, ShieldCheck, Lightbulb, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmployerInsights } from '@/lib/employer-insights';
import { formatRWF } from '@/lib/utils';
import { VerifiedBadge } from '@/components/trust/verified-badge';
import { HiringFunnel } from '@/components/employer/hiring-funnel';

export const dynamic = 'force-dynamic';

export default async function EmployerHome({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('employer');
  const tt = await getTranslations('trust');

  const user = (await getCurrentUser())!;
  const [insights, rating] = await Promise.all([
    getEmployerInsights(user.id, user.isVerified),
    prisma.review.aggregate({ where: { revieweeId: user.id }, _avg: { rating: true }, _count: true }),
  ]);

  const openFunnels = insights.funnels.filter((f) => f.status === 'OPEN').slice(0, 4);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('greeting', { name: user.fullName.split(' ')[0]! })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('homeSubtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Suggested action — full width, dynamic rule engine (§2) */}
        {insights.suggestion && (
          <Link
            href={insights.suggestion.type === 'review_applicants' ? '/employer/applicants' : insights.suggestion.type === 'verify_for_reach' ? '/verify' : '/employer/jobs'}
            className="group flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4 sm:col-span-2"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-accent-foreground/90">{t('suggestedAction')}</p>
              <p className="text-sm text-muted-foreground">
                {t(`suggest_${insights.suggestion.type}`, {
                  title: insights.suggestion.title ?? '',
                  count: insights.suggestion.count ?? 0,
                })}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        <Card href="/employer/jobs" icon={Briefcase} label={t('cardActivePostings')}>
          <p className="text-2xl font-extrabold">{insights.activeCount}</p>
          <p className="text-xs text-muted-foreground">
            {t('applicantsToday', { count: insights.applicantsToday })}
          </p>
        </Card>

        <Card href="/employer/applicants" icon={Users} label={t('cardNewApplicants')}>
          <p className="text-2xl font-extrabold">{insights.newApplicants}</p>
          <p className="text-xs text-muted-foreground">{t('unreviewed')}</p>
        </Card>

        <Card href="/wallet" icon={Wallet} label={t('cardWallet')}>
          <p className="text-2xl font-extrabold text-primary">
            {formatRWF(user.walletBalance, params.locale)}
          </p>
          <p className="text-xs text-muted-foreground">{t('available')}</p>
        </Card>

        <Card href="/verify" icon={ShieldCheck} label={t('cardTrust')}>
          <VerifiedBadge
            status={user.verificationStatus as 'VERIFIED' | 'PENDING' | 'UNVERIFIED'}
            label={user.isVerified ? tt('verifiedBadge') : undefined}
            size="md"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {rating._count > 0
              ? t('ratingFromHires', { rating: (rating._avg.rating ?? 0).toFixed(1), count: rating._count })
              : t('noRatingsYet')}
          </p>
        </Card>
      </div>

      {/* Hiring progress — per open job funnel (§2/§6) */}
      {openFunnels.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold tracking-tight">{t('hiringProgress')}</h2>
          <ul className="space-y-2">
            {openFunnels.map((f) => (
              <li key={f.id} className="rounded-xl border border-border bg-card p-4">
                <Link href={`/jobs/${f.id}/applicants`} className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="truncate font-medium hover:text-primary">{f.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t('viewsCount', { count: f.viewCount })}
                  </span>
                </Link>
                <HiringFunnel applied={f.applied} shortlisted={f.shortlisted} hired={f.hired} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Card({
  href,
  icon: Icon,
  label,
  children,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      {children}
    </Link>
  );
}
