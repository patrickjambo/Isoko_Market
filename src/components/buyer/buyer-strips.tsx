import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Clock, Package, ArrowRight, ImageOff, TrendingUp, Star, MapPin } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VerifiedBadge } from '@/components/trust/verified-badge';
import { StarRating } from '@/components/trust/star-rating';
import { ListingCard } from '@/components/marketplace/listing-card';
import { OrderStatusBadge } from '@/components/orders/order-status';
import { getBuyerHome, favoritedSet } from '@/lib/queries';
import { formatRWF, initials } from '@/lib/utils';

/**
 * Personalized buyer home (Section 2): Active Orders, Continue Where You Left
 * Off, "For You", Trending Near You, and Recommended Sellers — shown above the
 * marketing content for signed-in users. Photo-forward, minimal text.
 */
export async function BuyerStrips({
  userId,
  location,
  locale,
}: {
  userId: string;
  location?: string | null;
  locale: string;
}) {
  const t = await getTranslations('buyer');
  const tt = await getTranslations('trust');
  const { recentlyViewed, activeOrders, forYou, trending, recommendedSellers } = await getBuyerHome(
    userId,
    location
  );

  if (
    recentlyViewed.length === 0 &&
    activeOrders.length === 0 &&
    forYou.length === 0 &&
    trending.length === 0
  ) {
    return null;
  }

  const favIds = await favoritedSet(
    userId,
    [...recentlyViewed, ...forYou, ...trending].map((l) => l.id)
  );

  return (
    <div className="container space-y-8 py-8">
      {/* Active orders */}
      {activeOrders.length > 0 && (
        <section>
          <SectionHeader icon={Package} title={t('activeOrders')} href="/orders" />
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {activeOrders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex w-64 shrink-0 items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {o.image ? (
                    <Image src={o.image} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageOff className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.title}</p>
                  <p className="text-xs font-semibold text-primary">{formatRWF(o.amount, locale)}</p>
                </div>
                <OrderStatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Continue where you left off */}
      {recentlyViewed.length > 0 && (
        <section>
          <SectionHeader icon={Clock} title={t('continueViewing')} />
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {recentlyViewed.slice(0, 8).map((l) => (
              <div key={l.id} className="w-36 shrink-0">
                <ListingCard listing={{ ...l, favorited: favIds.has(l.id) }} showFavorite />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trending near you */}
      {trending.length > 0 && (
        <section>
          <SectionHeader icon={TrendingUp} title={t('trendingNear')} href="/marketplace" />
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {trending.map((l) => (
              <div key={l.id} className="w-36 shrink-0">
                <ListingCard listing={{ ...l, favorited: favIds.has(l.id) }} showFavorite />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended sellers — trust before first contact */}
      {recommendedSellers.length > 0 && (
        <section>
          <SectionHeader icon={Star} title={t('recommendedSellers')} />
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {recommendedSellers.map((s) => (
              <Link
                key={s.id}
                href={`/profile/${s.id}`}
                className="flex w-56 shrink-0 items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-secondary/40"
              >
                <Avatar className="h-11 w-11">
                  {s.avatarUrl && <AvatarImage src={s.avatarUrl} alt={s.fullName} />}
                  <AvatarFallback>{initials(s.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{s.fullName}</span>
                    <VerifiedBadge status="VERIFIED" label={tt('verifiedBadge')} />
                  </div>
                  {s.reviews > 0 ? (
                    <StarRating value={s.rating} count={s.reviews} />
                  ) : (
                    s.location && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {s.location}
                      </span>
                    )
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* For You */}
      {forYou.length > 0 && (
        <section>
          <SectionHeader icon={ArrowRight} title={t('forYou')} href="/marketplace" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {forYou.map((l) => (
              <ListingCard key={l.id} listing={{ ...l, favorited: favIds.has(l.id) }} showFavorite />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  href,
}: {
  icon: typeof Clock;
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <Icon className="h-5 w-5 text-primary" /> {title}
      </h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-primary hover:underline">
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
