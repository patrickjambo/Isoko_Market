import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MapPin, Tag, Phone } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { ImageGallery } from '@/components/marketplace/image-gallery';
import { ListingCard } from '@/components/marketplace/listing-card';
import { SellerTrustCard } from '@/components/trust/seller-trust-card';
import { MessageSellerButton } from '@/components/messaging/message-seller-button';
import { ContactLinks } from '@/components/shared/contact-links';
import { asContact } from '@/lib/contact';
import { FavoriteButton } from '@/components/marketplace/favorite-button';
import { BuyNowButton } from '@/components/orders/buy-now-button';
import { ReportDialog } from '@/components/trust/report-dialog';
import { ListingOwnerActions } from '@/components/marketplace/listing-owner-actions';
import { LiveItemStatus } from '@/components/shared/live-item-status';
import { getListing, getSimilarListings } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { suggestPrice } from '@/lib/suggestions';
import { formatRWF, timeAgo, cn } from '@/lib/utils';
import { formatPhoneDisplay } from '@/lib/phone';
import { categoryName } from '@/lib/i18n-helpers';
import { categoryFallbackImage } from '@/lib/listing-image';

export const dynamic = 'force-dynamic';

export default async function ListingDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const [t, tt, listing, user] = await Promise.all([
    getTranslations('marketplace'),
    getTranslations('trust'),
    getListing(params.id),
    getCurrentUser(),
  ]);

  if (!listing || listing.status === 'REMOVED') notFound();

  const isOwner = user?.id === listing.seller.id;

  // Count a view + record buyer history (owners don't inflate their own numbers).
  if (!isOwner) {
    void prisma.listing
      .update({ where: { id: listing.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
    if (user) {
      void prisma.listingView
        .upsert({
          where: { userId_listingId: { userId: user.id, listingId: listing.id } },
          create: { userId: user.id, listingId: listing.id },
          update: {}, // @updatedAt bumps viewedAt
        })
        .catch(() => {});
    }
  }

  const [ratingAgg, favCount, myFavorite, similar, priceCtx] = await Promise.all([
    prisma.review.aggregate({ where: { revieweeId: listing.seller.id }, _avg: { rating: true } }),
    prisma.favorite.count({ where: { listingId: listing.id } }),
    user
      ? prisma.favorite.findUnique({
          where: { userId_listingId: { userId: user.id, listingId: listing.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
    getSimilarListings({ id: listing.id, categoryId: listing.categoryId, location: listing.location }),
    listing.categoryId
      ? suggestPrice(listing.categoryId, listing.location)
      : Promise.resolve({ count: 0, min: null, max: null, median: null }),
  ]);

  // Price context vs. similar items nearby (Section 4).
  let priceContext: 'below' | 'fair' | 'above' | null = null;
  if (priceCtx.median != null) {
    const priceFrancs = listing.price / 100;
    if (priceFrancs < priceCtx.median * 0.9) priceContext = 'below';
    else if (priceFrancs > priceCtx.median * 1.15) priceContext = 'above';
    else priceContext = 'fair';
  }

  return (
    <div className="container py-6">
      <LiveItemStatus topic={`listing:${listing.id}`} />

      <div className="grid gap-8 lg:grid-cols-2">
        <ImageGallery
          images={
            listing.images.length
              ? listing.images
              : [{ url: categoryFallbackImage(listing.category?.slug) }]
          }
          alt={listing.title}
        />

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {listing.status === 'SOLD' && <Badge variant="secondary">{t('sold')}</Badge>}
              {listing.isFeatured && listing.status === 'ACTIVE' && (
                <Badge variant="accent">{t('featured')}</Badge>
              )}
              <Badge variant="outline">{t(`condition.${listing.condition}`)}</Badge>
            </div>
            <p className="text-3xl font-extrabold text-primary">
              {formatRWF(listing.price, params.locale)}
            </p>
            {priceContext && (
              <p
                className={cn(
                  'text-sm font-medium',
                  priceContext === 'below'
                    ? 'text-success'
                    : priceContext === 'above'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                )}
              >
                {t(`priceContext_${priceContext}`)}
              </p>
            )}
            <h1 className="text-2xl font-bold tracking-tight">{listing.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {listing.location}
              </span>
              {listing.category && (
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-4 w-4" /> {categoryName(listing.category, params.locale)}
                </span>
              )}
              <span>{t('postedAgo', { time: timeAgo(listing.createdAt, params.locale) })}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isOwner ? (
              <ListingOwnerActions
                listingId={listing.id}
                status={listing.status}
                isFeatured={listing.isFeatured}
              />
            ) : (
              <>
                {listing.status === 'ACTIVE' && (
                  <BuyNowButton
                    listingId={listing.id}
                    price={listing.price}
                    locale={params.locale}
                  />
                )}
                <MessageSellerButton
                  listingId={listing.id}
                  label={t('messageSeller')}
                  variant="outline"
                />
                <FavoriteButton
                  listingId={listing.id}
                  initialFavorited={Boolean(myFavorite)}
                  initialCount={favCount}
                />
              </>
            )}
            {!isOwner && (
              <ReportDialog targetType="LISTING" targetId={listing.id} label={tt('reportListing')} />
            )}
          </div>

          {/* Seller contact — phone only if the seller opted in AND provided one */}
          {!isOwner && listing.showPhone && listing.seller.phone && (
            <a
              href={`tel:${listing.seller.phone}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium"
            >
              <Phone className="h-4 w-4 text-primary" /> {formatPhoneDisplay(listing.seller.phone)}
            </a>
          )}

          {/* Extra contact the seller added — tap-to-call / WhatsApp / email / IG. */}
          {asContact(listing.contactInfo) && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">{t('contactLabel')}</p>
              <ContactLinks contact={asContact(listing.contactInfo)} />
            </div>
          )}

          <div className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
            {listing.description}
          </div>

          <SellerTrustCard
            person={listing.seller}
            rating={ratingAgg._avg.rating ?? 0}
            reviewCount={listing.seller._count.reviewsReceived}
            itemCount={listing.seller._count.listings}
            itemCountLabel={t('title').toLowerCase()}
            locale={params.locale}
          />
        </div>
      </div>

      {/* Similar listings carousel (Section 4) — no re-search needed */}
      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold tracking-tight">{t('similarListings')}</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {similar.map((s) => (
              <div key={s.id} className="w-40 shrink-0">
                <ListingCard listing={s} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
