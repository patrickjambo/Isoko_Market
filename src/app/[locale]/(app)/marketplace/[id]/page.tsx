import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MapPin, Tag, Phone, Navigation } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { ImageGallery } from '@/components/marketplace/image-gallery';
import { ListingCard } from '@/components/marketplace/listing-card';
import { LocationMap } from '@/components/marketplace/location-map';
import { SellerTrustCard } from '@/components/trust/seller-trust-card';
import { MessageSellerButton } from '@/components/messaging/message-seller-button';
import { ContactLinks } from '@/components/shared/contact-links';
import { asContact } from '@/lib/contact';
import { FavoriteButton } from '@/components/marketplace/favorite-button';
import { BuyNowButton } from '@/components/orders/buy-now-button';
import { RequestServiceButton } from '@/components/marketplace/request-service-button';
import { ReportDialog } from '@/components/trust/report-dialog';
import { ShareButton } from '@/components/shared/share-button';
import { ListingOwnerActions } from '@/components/marketplace/listing-owner-actions';
import { LiveItemStatus } from '@/components/shared/live-item-status';
import { getListing, getSimilarListings } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { suggestPrice } from '@/lib/suggestions';
import { formatRWF, timeAgo, initials, cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { StarRating } from '@/components/trust/star-rating';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  const [t, tt, tc, listing, user] = await Promise.all([
    getTranslations('marketplace'),
    getTranslations('trust'),
    getTranslations('common'),
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

  const [ratingAgg, favCount, myFavorite, similar, priceCtx, openRequest, reviews] = await Promise.all([
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
    // Has the viewer already got an open request for this service?
    user && !isOwner && listing.kind === 'SERVICE'
      ? prisma.serviceRequest.findFirst({
          where: {
            listingId: listing.id,
            requesterId: user.id,
            status: { in: ['REQUESTED', 'CONFIRMED'] },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    // Reviews OF this product/service (rating stars + comments).
    prisma.review.findMany({
      where: { listingId: listing.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { reviewer: { select: { fullName: true, avatarUrl: true } } },
    }),
  ]);
  const hasOpenRequest = Boolean(openRequest);

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
              {listing.kind === 'SERVICE' ? (
                <Badge variant="outline">{t('serviceBadge')}</Badge>
              ) : (
                <Badge variant="outline">{t(`condition.${listing.condition}`)}</Badge>
              )}
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
            {listing.ratingCount > 0 && (
              <StarRating value={listing.ratingAvg} count={listing.ratingCount} />
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {listing.location}
              </span>
              {listing.latitude != null && listing.longitude != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Navigation className="h-4 w-4" /> {t('getDirections')}
                </a>
              )}
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
                {/* Products use the manual-payment order flow; a service is a
                    tracked request the provider confirms — so it leads with a
                    formal "Request this service" (terms + confirm), not Buy Now. */}
                {listing.status === 'ACTIVE' && listing.kind === 'SERVICE' ? (
                  <RequestServiceButton
                    listingId={listing.id}
                    label={t('requestService')}
                    alreadyRequested={hasOpenRequest}
                  />
                ) : (
                  listing.status === 'ACTIVE' &&
                  listing.kind !== 'SERVICE' && (
                    <BuyNowButton
                      listingId={listing.id}
                      price={listing.price}
                      locale={params.locale}
                    />
                  )
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
            <ShareButton title={listing.title} label={tc('share')} />
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

          <div className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 shadow-sm text-sm leading-relaxed">
            {listing.description}
          </div>

          {/* Product specifications (RAM, processor, year, …) so the buyer sees
              the full details before contacting/buying. */}
          {(() => {
            const specs = Array.isArray(listing.specs)
              ? (listing.specs as { label?: string; value?: string }[]).filter(
                  (s) => s?.label?.trim() && s?.value?.trim()
                )
              : [];
            if (specs.length === 0) return null;
            return (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">{t('specifications')}</h2>
                <dl className="divide-y divide-border/60 text-sm">
                  {specs.map((s, i) => (
                    <div key={i} className="flex justify-between gap-3 py-1.5">
                      <dt className="text-muted-foreground">{s.label}</dt>
                      <dd className="text-right font-medium">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })()}

          <SellerTrustCard
            person={listing.seller}
            rating={ratingAgg._avg.rating ?? 0}
            reviewCount={listing.seller._count.reviewsReceived}
            itemCount={listing.seller._count.listings}
            itemCountLabel={t('title').toLowerCase()}
            locale={params.locale}
            linkAnchor="store"
          />
        </div>
      </div>

      {/* Location + in-app route (only when the listing has a precise pin). */}
      {listing.latitude != null && listing.longitude != null && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold tracking-tight">{t('locationTitle')}</h2>
          <LocationMap lat={listing.latitude} lng={listing.longitude} title={listing.title} />
        </section>
      )}

      {/* Product / service reviews — stars + comments from real buyers/clients */}
      {reviews.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">{t('reviewsTitle')}</h2>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-accent text-accent" />
              <span className="font-semibold text-foreground">{listing.ratingAvg.toFixed(1)}</span>
              <span>({listing.ratingCount})</span>
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
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
        </section>
      )}

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
