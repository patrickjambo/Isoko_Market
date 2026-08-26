import { VerifiedBadge } from '@/components/trust/verified-badge';
import { StarRating } from '@/components/trust/star-rating';
import { cn } from '@/lib/utils';

type Status = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/**
 * Presentation-only composition wrapper (Unified rule 2) around the existing
 * VerifiedBadge + StarRating primitives, so the trust signal has identical
 * layout/spacing on every surface it appears — a listing card, a job card, a
 * profile/trust card, or a chat header.
 *
 * It renders NO data logic of its own: the caller passes the same
 * single-source values (verification status, aggregate rating) the primitives
 * already consume. Changing this file can never make the badge behave
 * differently — only look consistently arranged.
 */
export function TrustBadge({
  variant,
  status,
  verifiedLabel,
  rating,
  reviewCount,
  className,
}: {
  variant: 'listing' | 'job' | 'profile' | 'chat';
  status: Status;
  verifiedLabel?: string;
  /** Aggregate rating (0..5). Omit to hide the stars (e.g. cards without it). */
  rating?: number;
  reviewCount?: number;
  className?: string;
}) {
  // Chat headers are tight: verification only, larger icon, never stars.
  // Profiles get a little more breathing room and a medium badge.
  const badgeSize = variant === 'profile' || variant === 'chat' ? 'md' : 'sm';
  const showRating = variant !== 'chat' && typeof rating === 'number' && rating > 0;
  const gap = variant === 'profile' ? 'gap-x-3 gap-y-1' : 'gap-x-2 gap-y-1';

  return (
    <span className={cn('inline-flex flex-wrap items-center', gap, className)}>
      <VerifiedBadge status={status} label={verifiedLabel} size={badgeSize} />
      {showRating && <StarRating value={rating!} count={reviewCount} />}
    </span>
  );
}
