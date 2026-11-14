import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Package, Star, Briefcase } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ListingCard } from '@/components/marketplace/listing-card';
import { JobCard } from '@/components/jobs/job-card';
import { getEmployerOpenJobs } from '@/lib/queries';
import { StarRating } from '@/components/trust/star-rating';
import { EmptyState } from '@/components/shared/empty-state';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { initials, timeAgo } from '@/lib/utils';
import { getFeatureFlags } from '@/lib/feature-flags';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const BASE = env.NEXT_PUBLIC_APP_URL;
const LOCALES = ['en', 'rw', 'fr'] as const;

export async function generateMetadata({
  params,
}: {
  params: { locale: string; id: string };
}): Promise<Metadata> {
  const person = await prisma.user.findUnique({
    where: { id: params.id },
    select: { fullName: true, businessName: true, avatarUrl: true, location: true, isVerified: true },
  });
  if (!person) return {};

  const sellerName = person.businessName || person.fullName;
  const locationLabel = person.location ? ` — ${person.location}` : ' — Rwanda';
  const verifiedLabel = person.isVerified ? ' ✓ Verified Seller' : '';
  const title = `${sellerName}${locationLabel}${verifiedLabel} | Zenova Rwanda`;
  const description = `View ${sellerName}'s listings and ratings on Zenova Rwanda. Shop directly from verified sellers across Rwanda.`;

  const ogImage = person.avatarUrl
    ? (person.avatarUrl.startsWith('http') ? person.avatarUrl : `${BASE}${person.avatarUrl}`)
    : `${BASE}/og-default.png`;

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE}/en/profile/${params.id}`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${BASE}/${l}/profile/${params.id}`])),
    },
    openGraph: {
      title,
      description,
      url: `${BASE}/${params.locale}/profile/${params.id}`,
      siteName: 'Zenova Rwanda | Buy & Sell',
      images: [{ url: ogImage, width: 400, height: 400, alt: sellerName }],
      type: 'profile',
      locale: params.locale,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('profile');

  const [person, viewer, flags] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    getCurrentUser(),
    getFeatureFlags(),
  ]);
  if (!person) notFound();

  const [listings, jobs, ratingAgg, reviews, completedTx, itemsSold] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: person.id, status: 'ACTIVE' },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 60,
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
    flags.jobsEnabled ? getEmployerOpenJobs(person.id) : Promise.resolve([]),
    prisma.review.aggregate({ where: { revieweeId: person.id }, _avg: { rating: true } }),
    prisma.review.findMany({
      where: { revieweeId: person.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { reviewer: { select: { fullName: true, avatarUrl: true } } },
    }),
    // Transaction history summary (Section 6.1) — completed payments + items sold.
    prisma.transaction.count({ where: { userId: person.id, status: 'SUCCESS' } }),
    prisma.listing.count({ where: { sellerId: person.id, status: 'SOLD' } }),
  ]);

  return (
    <div className="container max-w-4xl space-y-6 py-6">
      <ProfileHeader
        person={person}
        isOwner={viewer?.id === person.id}
        rating={ratingAgg._avg.rating ?? 0}
        reviewCount={reviews.length}
        locale={params.locale}
      />

      {/* Transaction history summary (Section 6.1) */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('tradingSummary')}</h2>
        <dl className="grid grid-cols-3 gap-3">
          <SummaryStat label={t('completedTransactions')} value={completedTx} />
          <SummaryStat label={t('itemsSold')} value={itemsSold} />
          <SummaryStat label={t('reviews')} value={reviews.length} />
        </dl>
      </section>

      <section id="store" className="scroll-mt-20">
        <h2 className="mb-3 text-lg font-semibold">{t('store')}</h2>
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

      {jobs.length > 0 && (
        <section id="jobs" className="scroll-mt-20">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Briefcase className="h-5 w-5 text-primary" /> {t('openPositions')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('reviews')}</h2>
        {reviews.length === 0 ? (
          <EmptyState icon={Star} title={t('noReviews')} />
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {r.reviewer.avatarUrl && (
                      <AvatarImage src={r.reviewer.avatarUrl} alt={r.reviewer.fullName} />
                    )}
                    <AvatarFallback>{initials(r.reviewer.fullName)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">{r.reviewer.fullName}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {timeAgo(r.createdAt, params.locale)}
                  </span>
                </div>
                <StarRating value={r.rating} />
                {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <dd className="text-2xl font-extrabold text-primary">{value.toLocaleString()}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}
