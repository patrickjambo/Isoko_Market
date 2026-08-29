import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { TrustBadge } from '@/components/trust/trust-badge';
import { FavoriteHeart } from '@/components/marketplace/favorite-heart';
import { formatRWF, cn } from '@/lib/utils';
import { listingCover } from '@/lib/listing-image';

export type ListingCardData = {
  id: string;
  title: string;
  price: number;
  location: string;
  status: string;
  isFeatured: boolean;
  images: { url: string }[];
  category?: { slug: string } | null;
  seller: { fullName: string; isVerified: boolean; verificationStatus: string };
  favorited?: boolean;
};

export function ListingCard({
  listing,
  variant = 'grid',
  showFavorite = false,
}: {
  listing: ListingCardData;
  variant?: 'grid' | 'list';
  showFavorite?: boolean;
}) {
  const t = useTranslations('marketplace');
  const tt = useTranslations('trust');
  const locale = useLocale();
  // First uploaded photo, else a category-representative fallback (never broken).
  const cover = listingCover(listing.images, listing.category?.slug);

  // Compact horizontal row for the list view (Section 8.3).
  if (variant === 'list') {
    return (
      <Link
        href={`/marketplace/${listing.id}`}
        className="group flex gap-3 overflow-hidden rounded-xl border border-border bg-card p-2 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
          <Image
            src={cover}
            alt={listing.title}
            fill
            sizes="96px"
            className={cn('object-cover', listing.status === 'SOLD' && 'opacity-60 grayscale')}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-primary">{formatRWF(listing.price, locale)}</p>
            {listing.isFeatured && listing.status === 'ACTIVE' && (
              <Badge variant="accent">{t('featured')}</Badge>
            )}
            {listing.status === 'SOLD' && <Badge variant="secondary">{t('sold')}</Badge>}
          </div>
          <h3 className="line-clamp-1 font-medium text-foreground">{listing.title}</h3>
          <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> {listing.location}
            </span>
            {listing.seller.isVerified && (
              <TrustBadge variant="listing" status="VERIFIED" verifiedLabel={tt('verifiedBadge')} />
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {showFavorite && (
          <FavoriteHeart listingId={listing.id} initialFavorited={Boolean(listing.favorited)} />
        )}
        <Image
          src={cover}
          alt={listing.title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className={cn(
            'object-cover transition-transform group-hover:scale-105',
            listing.status === 'SOLD' && 'opacity-60 grayscale'
          )}
        />
        {listing.isFeatured && listing.status === 'ACTIVE' && (
          <Badge variant="accent" className="absolute left-2 top-2 shadow">
            {t('featured')}
          </Badge>
        )}
        {listing.status === 'SOLD' && (
          <Badge variant="secondary" className="absolute left-2 top-2">
            {t('sold')}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-base font-bold text-primary">{formatRWF(listing.price, locale)}</p>
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{listing.location}</span>
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
