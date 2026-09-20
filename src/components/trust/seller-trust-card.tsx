import { getTranslations } from 'next-intl/server';
import { CalendarDays, MapPin, Package, Store } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VerifiedBadge } from '@/components/trust/verified-badge';
import { StarRating } from '@/components/trust/star-rating';
import { ActiveIndicator } from '@/components/trust/active-indicator';
import { initials, isActiveToday, timeAgo } from '@/lib/utils';
import { storeName } from '@/lib/store';

type Person = {
  id: string;
  fullName: string;
  businessName: string | null;
  avatarUrl: string | null;
  location: string | null;
  isVerified: boolean;
  verificationStatus: string;
  createdAt: Date;
  lastActiveAt: Date | null;
};

/**
 * The trust card shown on every listing/job detail (Section 6.2). It bundles the
 * trust signals the brief calls "first-class": verification, rating, join date,
 * activity, and a summary count.
 */
export async function SellerTrustCard({
  person,
  rating,
  reviewCount,
  itemCount,
  itemCountLabel,
  locale,
  linkLabel,
  linkAnchor,
}: {
  person: Person;
  rating: number;
  reviewCount: number;
  itemCount: number;
  itemCountLabel: string;
  locale: string;
  /** Footer CTA label — defaults to "Visit store"; jobs pass "View all jobs". */
  linkLabel?: string;
  /** Section anchor on the profile to land on ("store" | "jobs"). */
  linkAnchor?: string;
}) {
  const t = await getTranslations('profile');
  const tt = await getTranslations('trust');
  const active = isActiveToday(person.lastActiveAt);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Link href={`/profile/${person.id}`} className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt={storeName(person)} />}
          <AvatarFallback>{initials(storeName(person))}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{storeName(person)}</p>
            {person.isVerified && (
              <VerifiedBadge status="VERIFIED" label={tt('verifiedBadge')} />
            )}
          </div>
          {reviewCount > 0 ? (
            <StarRating value={rating} count={reviewCount} />
          ) : (
            <p className="text-xs text-muted-foreground">{t('noReviews')}</p>
          )}
        </div>
      </Link>

      <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span>
            {itemCount} {itemCountLabel}
          </span>
        </div>
        {person.location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>{person.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          <span>
            {t('memberSince', {
              date: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(
                person.createdAt
              ),
            })}
          </span>
        </div>
        <ActiveIndicator
          active={active}
          label={active ? t('activeToday') : t('lastActive', { time: person.lastActiveAt ? timeAgo(person.lastActiveAt, locale) : '—' })}
        />
      </dl>

      {/* Explicit way to see everything this seller/shop is selling. */}
      <Link
        href={`/profile/${person.id}${linkAnchor ? `#${linkAnchor}` : ''}`}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 py-2 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
      >
        <Store className="h-4 w-4" /> {linkLabel ?? t('visitStore')}
      </Link>
    </div>
  );
}
