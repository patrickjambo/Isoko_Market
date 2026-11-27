import Image from 'next/image';
import { MapPin, Star } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { TrustBadge } from '@/components/trust/trust-badge';
import { FavoriteHeart } from '@/components/marketplace/favorite-heart';
import { formatRWF, cn, formatDistance } from '@/lib/utils';
import { listingCover } from '@/lib/listing-image';
import { isDiscountActive, discountPercent } from '@/lib/discount';

export type ListingCardData = {
  id: string;
  title: string;
  price: number;
  location: string;
  status: string;
  isFeatured: boolean;
  kind?: string;
  distanceKm?: number;
  ratingAvg?: number;
  ratingCount?: number;
  images: { url: string }[];
  category?: { slug: string } | null;
  seller: { fullName: string; isVerified: boolean; verificationStatus: string };
  favorited?: boolean;
  discountPrice?: number | null;
  discountEndsAt?: string | Date | null;
};

export function ListingCard({
  listing,
  variant = 'grid',
  showFavorite = true,
}: {
  listing: ListingCardData;
  variant?: 'grid' | 'list';
  showFavorite?: boolean;
}) {
  const t = useTranslations('marketplace');
  const tt = useTranslations('trust');
  const locale = useLocale();
  const cover = listingCover(listing.images, listing.category?.slug);

  const activeDiscount = isDiscountActive(listing);
  const salePrice = activeDiscount ? listing.discountPrice! : null;
  const pctOff = salePrice ? discountPercent(listing.price, salePrice) : 0;

  // Countdown — only shown server-side for deals ending within 24h
  const countdownLabel = (() => {
    if (!activeDiscount || !listing.discountEndsAt) return null;
    const ms = new Date(listing.discountEndsAt).getTime() - Date.now();
    if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return null;
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `Ends in ${h}h ${m}m`;
  })();

  // ── List variant ───────────────────────────────────────────────────────────
  if (variant === 'list') {
    return (
      <Link
        href={`/marketplace/${listing.id}`}
        className="group flex gap-3 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
          <Image
            src={cover}
            alt={listing.title}
            fill
            sizes="96px"
            className={cn(
              'object-cover transition-transform duration-500 ease-out group-hover:scale-110',
              listing.status === 'SOLD' && 'opacity-60 grayscale'
            )}
          />
          {activeDiscount && salePrice && (
            <span className="absolute left-1 top-1 rounded bg-destructive px-1 py-0.5 text-[9px] font-bold text-destructive-foreground">
              -{pctOff}%
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {salePrice ? (
              <>
                <p className="text-base font-bold text-primary">{formatRWF(salePrice, locale)}</p>
                <p className="text-xs text-muted-foreground line-through">{formatRWF(listing.price, locale)}</p>
              </>
            ) : (
              <p className="text-base font-bold text-primary">
                {listing.price > 0 ? formatRWF(listing.price, locale) : '—'}
              </p>
            )}
            {listing.kind === 'SERVICE' && <Badge variant="outline">{t('serviceBadge')}</Badge>}
            {listing.isFeatured && listing.status === 'ACTIVE' && (
              <Badge variant="accent">{t('featured')}</Badge>
            )}
            {listing.status === 'SOLD' && <Badge variant="secondary">{t('sold')}</Badge>}
          </div>
          <h3 className="line-clamp-1 font-medium text-foreground">{listing.title}</h3>
          {listing.ratingCount ? (
            <div className="flex items-center gap-1 text-xs">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              <span className="font-semibold text-foreground">{listing.ratingAvg?.toFixed(1)}</span>
              <span className="text-muted-foreground">({listing.ratingCount})</span>
            </div>
          ) : null}
          <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> {listing.location}
            </span>
            {listing.distanceKm != null && Number.isFinite(listing.distanceKm) && (
              <span className="font-medium text-primary">{formatDistance(listing.distanceKm)}</span>
            )}
            {listing.seller.isVerified && (
              <TrustBadge variant="listing" status="VERIFIED" verifiedLabel={tt('verifiedBadge')} />
            )}
          </div>
        </div>
      </Link>
    );
  }

  // ── Grid variant (default) ─────────────────────────────────────────────────
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {showFavorite && (
          <FavoriteHeart listingId={listing.id} initialFavorited={Boolean(listing.favorited)} />
        )}
        <Image
          src={cover}
          alt={listing.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 16vw"
          className={cn(
            'object-cover transition-transform duration-500 ease-out group-hover:scale-110',
            listing.status === 'SOLD' && 'opacity-60 grayscale'
          )}
        />
        {/* Discount badge — top-left (doesn't overlap heart at top-right) */}
        {activeDiscount && salePrice && (
          <span className="absolute left-2 top-2 z-10 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground shadow">
            -{pctOff}%
          </span>
        )}
        {listing.isFeatured && listing.status === 'ACTIVE' && !activeDiscount && (
          <Badge variant="accent" className="absolute left-2 top-2 shadow">
            {t('featured')}
          </Badge>
        )}
        {listing.status === 'SOLD' && (
          <Badge variant="secondary" className="absolute left-2 top-2">
            {t('sold')}
          </Badge>
        )}
        {listing.kind === 'SERVICE' && listing.status === 'ACTIVE' && !listing.isFeatured && !activeDiscount && (
          <Badge variant="outline" className="absolute left-2 top-2 bg-card/90 shadow">
            {t('serviceBadge')}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {/* Price row with discount */}
        <div className="flex flex-wrap items-center gap-1.5">
          {salePrice ? (
            <>
              <p className="text-base font-bold text-primary">{formatRWF(salePrice, locale)}</p>
              <p className="text-xs text-muted-foreground line-through">{formatRWF(listing.price, locale)}</p>
            </>
          ) : (
            <p className="text-base font-bold text-primary">
              {listing.price > 0 ? formatRWF(listing.price, locale) : '—'}
            </p>
          )}
        </div>
        {/* Urgency countdown */}
        {countdownLabel && (
          <p className="text-[10px] font-medium text-destructive">⏱ {countdownLabel}</p>
        )}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{listing.location}</span>
          {listing.distanceKm != null && Number.isFinite(listing.distanceKm) && (
            <span className="shrink-0 font-medium text-primary">
              · {formatDistance(listing.distanceKm)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {listing.seller.isVerified && (
            <TrustBadge variant="listing" status="VERIFIED" verifiedLabel={tt('verifiedBadge')} />
          )}
          <span className="truncate text-xs text-muted-foreground">
            {listing.seller.fullName}
          </span>
        </div>
      </div>
    </Link>
  );
}
