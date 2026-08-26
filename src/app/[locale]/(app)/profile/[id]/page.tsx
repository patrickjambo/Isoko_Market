import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Package, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ListingCard } from '@/components/marketplace/listing-card';
import { StarRating } from '@/components/trust/star-rating';
import { EmptyState } from '@/components/shared/empty-state';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { initials, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PublicProfilePage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('profile');

  const [person, viewer] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    getCurrentUser(),
  ]);
  if (!person) notFound();

  const [listings, ratingAgg, reviews, completedTx, itemsSold] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: person.id, status: 'ACTIVE' },
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

      <section>
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
