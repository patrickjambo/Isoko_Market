import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { env } from '@/lib/env';
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
import { quoteCommission } from '@/lib/commission';
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

// ── SEO: Per-listing metadata ─────────────────────────────────────────────────
// Called by Next.js before rendering — fetches only the minimum needed fields.
export async function generateMetadata({
  params,
}: {
  params: { locale: string; id: string };
}): Promise<Metadata> {
  const listing = await getListing(params.id);
  if (!listing || listing.status === 'REMOVED') return {};

  const BASE = env.NEXT_PUBLIC_APP_URL;
  const LOCALES = ['en', 'rw', 'fr'] as const;

  const sellerName = listing.seller.businessName || listing.seller.fullName;
  const locationLabel = listing.location ? ` in ${listing.location}` : '';
  const kindLabel = listing.kind === 'SERVICE' ? 'Service' : 'For Sale';

  const title = `${listing.title}${locationLabel} – ${kindLabel} | Zenova Rwanda`;
  const rawDesc = listing.description?.replace(/\s+/g, ' ').trim() ?? '';
  const description = rawDesc.length > 155 ? rawDesc.slice(0, 152) + '…' : rawDesc ||
    `${listing.title} listed by ${sellerName}${locationLabel} on Zenova Rwanda marketplace.`;

  const firstImage = listing.images[0]?.url;
  // Resolve relative upload URLs to absolute (needed for OG crawlers)
  const ogImage = firstImage
    ? firstImage.startsWith('http') ? firstImage : `${BASE}${firstImage}`
    : `${BASE}/icon-512.png`;

  const canonicalPath = `/en/marketplace/${listing.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE}${canonicalPath}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `${BASE}/${l}/marketplace/${listing.id}`])
      ),
    },
    openGraph: {
      title,
      description,
      url: `${BASE}${canonicalPath}`,
      siteName: 'Zenova Rwanda',
      images: [{ url: ogImage, width: 1200, height: 630, alt: listing.title }],
      type: 'website',
      locale: params.locale,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

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
  if (listing.price > 0 && priceCtx.median != null) {
    const priceFrancs = listing.price / 100;
    if (priceFrancs < priceCtx.median * 0.9) priceContext = 'below';
    else if (priceFrancs > priceCtx.median * 1.15) priceContext = 'above';
    else priceContext = 'fair';
  }

  return (
    <div className="container py-6">
      <LiveItemStatus topic={`listing:${listing.id}`} />

      {/* ── Structured data: Product / Service + BreadcrumbList (Google Rich Results) ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': listing.kind === 'SERVICE' ? 'Service' : 'Product',
              name: listing.title,
              description: listing.description || listing.title,
              image:
                listing.images.length > 0
                  ? listing.images.map((img) =>
                      img.url.startsWith('http') ? img.url : `${env.NEXT_PUBLIC_APP_URL}${img.url}`
                    )
                  : [
                      categoryFallbackImage(listing.category?.slug).startsWith('http')
                        ? categoryFallbackImage(listing.category?.slug)
                        : `${env.NEXT_PUBLIC_APP_URL}${categoryFallbackImage(listing.category?.slug)}`,
                    ],
              url: `${env.NEXT_PUBLIC_APP_URL}/en/marketplace/${listing.id}`,
              ...(listing.kind === 'SERVICE'
                ? {
                    provider: {
                      '@type': 'Person',
                      name: listing.seller.businessName || listing.seller.fullName,
                    },
                    areaServed: {
                      '@type': 'Country',
                      name: 'Rwanda',
                    },
                    serviceType: listing.category ? categoryName(listing.category, params.locale) : 'Service',
                  }
                : {
                    brand: {
                      '@type': 'Brand',
                      name: listing.seller.businessName || 'Zenova Rwanda',
                    },
                    category: listing.category ? categoryName(listing.category, params.locale) : undefined,
                  }),
              offers: {
                '@type': 'Offer',
                priceCurrency: 'RWF',
                price: ((listing.price || 0) / 100).toFixed(0),
                priceValidUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0],
                availability:
                  listing.status === 'ACTIVE'
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
                url: `${env.NEXT_PUBLIC_APP_URL}/en/marketplace/${listing.id}`,
                ...(listing.kind !== 'SERVICE'
                  ? {
                      itemCondition:
                        listing.condition === 'NEW'
                          ? 'https://schema.org/NewCondition'
                          : listing.condition === 'LIKE_NEW'
                            ? 'https://schema.org/LikeNewCondition'
                            : listing.condition === 'FOR_PARTS'
                              ? 'https://schema.org/DamagedCondition'
                              : 'https://schema.org/UsedCondition',
                    }
                  : {}),
                seller: {
                  '@type': 'Person',
                  name: listing.seller.businessName || listing.seller.fullName,
                },
              },
              ...(listing.ratingCount > 0 && listing.ratingAvg > 0
                ? {
                    aggregateRating: {
                      '@type': 'AggregateRating',
                      ratingValue: listing.ratingAvg.toFixed(1),
                      reviewCount: listing.ratingCount,
                    },
                  }
                : {}),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `${env.NEXT_PUBLIC_APP_URL}/en` },
                { '@type': 'ListItem', position: 2, name: 'Marketplace', item: `${env.NEXT_PUBLIC_APP_URL}/en/marketplace` },
                ...(listing.category
                  ? [
                      {
                        '@type': 'ListItem',
                        position: 3,
                        name: categoryName(listing.category, params.locale),
                        item: `${env.NEXT_PUBLIC_APP_URL}/en/marketplace?categoryId=${listing.category.id}`,
                      },
                      {
                        '@type': 'ListItem',
                        position: 4,
                        name: listing.title,
                        item: `${env.NEXT_PUBLIC_APP_URL}/en/marketplace/${listing.id}`,
                      },
                    ]
                  : [
                      {
                        '@type': 'ListItem',
                        position: 3,
                        name: listing.title,
                        item: `${env.NEXT_PUBLIC_APP_URL}/en/marketplace/${listing.id}`,
                      },
                    ]),
              ],
            },
          ]),
        }}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* min-w-0 prevents the thumbnail strip from expanding the column beyond viewport width */}
        <div className="min-w-0">
          <ImageGallery
            images={
              listing.images.length
                ? listing.images
                : [{ url: categoryFallbackImage(listing.category?.slug) }]
            }
            alt={listing.title}
          />
        </div>

        <div className="min-w-0 space-y-5">
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
              {/* Stock badge — only for products with explicit stock tracking */}
              {(() => {
                // @ts-ignore — stockQty field added in migration; present after prisma generate
                const stockQty = (listing as unknown as { stockQty?: number | null }).stockQty ?? null;
                if (listing.kind === 'SERVICE' || stockQty === null) return null;
                if (stockQty === 0) return (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                    {t('outOfStock')}
                  </Badge>
                );
                if (stockQty === 1) return (
                  <Badge variant="secondary" className="bg-accent/15 text-accent">
                    {t('stockOne')}
                  </Badge>
                );
                if (stockQty <= 5) return (
                  <Badge variant="secondary" className="bg-accent/15 text-accent">
                    {t('stockLow', { count: stockQty })}
                  </Badge>
                );
                return (
                  <Badge variant="secondary" className="text-muted-foreground">
                    {t('stockLeft', { count: stockQty })}
                  </Badge>
                );
              })()}
            </div>
            <p className="text-3xl font-extrabold text-primary">
              {listing.price > 0 ? formatRWF(listing.price, params.locale) : '—'}
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
                  listing.kind !== 'SERVICE' &&
                  listing.price > 0 && (
                    <BuyNowButton
                      listingId={listing.id}
                      price={listing.price}
                      fee={(await quoteCommission(listing.price, listing.seller.createdAt)).fee}
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
          <div className="flex max-w-full gap-3 overflow-x-auto pb-2">
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
