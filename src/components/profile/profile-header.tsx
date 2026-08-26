import { getTranslations } from 'next-intl/server';
import { CalendarDays, MapPin, Pencil, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { VerifiedBadge } from '@/components/trust/verified-badge';
import { StarRating } from '@/components/trust/star-rating';
import { ActiveIndicator } from '@/components/trust/active-indicator';
import { initials, isActiveToday, timeAgo } from '@/lib/utils';

type Person = {
  id: string;
  fullName: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  isVerified: boolean;
  verificationStatus: string;
  createdAt: Date;
  lastActiveAt: Date | null;
};

export async function ProfileHeader({
  person,
  isOwner,
  rating,
  reviewCount,
  locale,
}: {
  person: Person;
  isOwner: boolean;
  rating: number;
  reviewCount: number;
  locale: string;
}) {
  const t = await getTranslations('profile');
  const tt = await getTranslations('trust');
  const tv = await getTranslations('verification');
  const active = isActiveToday(person.lastActiveAt);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar className="h-20 w-20 text-2xl">
          {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt={person.fullName} />}
          <AvatarFallback>{initials(person.fullName)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{person.fullName}</h1>
            <VerifiedBadge
              status={person.verificationStatus as 'VERIFIED' | 'PENDING' | 'UNVERIFIED'}
              label={person.isVerified ? tt('verifiedBadge') : undefined}
              size="md"
            />
          </div>

          {reviewCount > 0 && <StarRating value={rating} count={reviewCount} />}
          {person.bio && <p className="text-sm text-muted-foreground">{person.bio}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {person.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {person.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {t('memberSince', {
                date: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(
                  person.createdAt
                ),
              })}
            </span>
            <ActiveIndicator
              active={active}
              label={
                active
                  ? t('activeToday')
                  : t('lastActive', {
                      time: person.lastActiveAt ? timeAgo(person.lastActiveAt, locale) : '—',
                    })
              }
            />
          </div>
        </div>

        {isOwner && (
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/profile/settings">
                <Pencil className="h-4 w-4" /> {t('editProfile')}
              </Link>
            </Button>
            {!person.isVerified && (
              <Button variant="accent" size="sm" asChild>
                <Link href="/verify">
                  <ShieldCheck className="h-4 w-4" /> {tv('title')}
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
