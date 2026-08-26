import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Package, Briefcase, FileText, Wallet, ChevronRight, Crown, BadgeCheck } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ListingCard } from '@/components/marketplace/listing-card';
import { EmptyState } from '@/components/shared/empty-state';
import { PaymentButton } from '@/components/payments/payment-button';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PRICING, SUBSCRIPTION_DURATION_DAYS } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('profile');
  const tp = await getTranslations('premium');

  const [listings, ratingAgg, reviewCount, counts] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: user.id, status: { not: 'REMOVED' } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        status: true,
        isFeatured: true,
        images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } },
        seller: { select: { fullName: true, isVerified: true, verificationStatus: true } },
      },
    }),
    prisma.review.aggregate({ where: { revieweeId: user.id }, _avg: { rating: true } }),
    prisma.review.count({ where: { revieweeId: user.id } }),
    Promise.all([
      prisma.application.count({ where: { applicantId: user.id } }),
      prisma.job.count({ where: { employerId: user.id } }),
    ]),
  ]);

  const [applicationCount, jobCount] = counts;

  const links = [
    { href: '/profile/applications', icon: FileText, label: t('myApplications'), count: applicationCount },
    { href: '/jobs/new', icon: Briefcase, label: t('myJobs'), count: jobCount },
    { href: '/wallet', icon: Wallet, label: t('transactionHistory') },
  ];

  return (
    <div className="container max-w-4xl space-y-6 py-6">
      <ProfileHeader
        person={user}
        isOwner
        rating={ratingAgg._avg.rating ?? 0}
        reviewCount={reviewCount}
        locale={params.locale}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="flex-1 font-medium">{l.label}</span>
              {typeof l.count === 'number' && (
                <span className="rounded-full bg-secondary px-2 text-sm text-secondary-foreground">
                  {l.count}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      {/* Premium — verified-seller subscription (Section 6.2) */}
      <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                {tp('subscriptionTitle')}
                <span className="text-sm font-normal text-muted-foreground">
                  RWF {PRICING.VERIFIED_SUBSCRIPTION.toLocaleString()} {tp('perMonth')}
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">
                {tp('subscriptionBody', { days: SUBSCRIPTION_DURATION_DAYS })}
              </p>
            </div>
          </div>
          <PaymentButton
            type="SUBSCRIPTION"
            amount={PRICING.VERIFIED_SUBSCRIPTION}
            label={tp('subscribeCta')}
            title={tp('subscriptionTitle')}
            description={tp('subscriptionBody', { days: SUBSCRIPTION_DURATION_DAYS })}
            icon={BadgeCheck}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('myListings')}</h2>
        {listings.length === 0 ? (
          <EmptyState icon={Package} title={t('listings')} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
