import { BadgeCheck, ShieldAlert, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/**
 * The single source of truth for showing verification status. Per Section 3
 * ("Trust first"), this appears on every profile, listing and job card so users
 * always know who they are dealing with.
 */
export function VerifiedBadge({
  status,
  label,
  className,
  size = 'sm',
}: {
  status: Status;
  /** Localized label, e.g. t('trust.verifiedBadge'). */
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const iconClass = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  if (status === 'VERIFIED') {
    return (
      <Badge variant="success" className={className}>
        <BadgeCheck className={iconClass} aria-hidden />
        {label ?? 'Verified'}
      </Badge>
    );
  }
  if (status === 'PENDING') {
    return (
      <Badge variant="muted" className={className}>
        <Clock className={iconClass} aria-hidden />
        {label ?? 'Pending'}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn('text-muted-foreground', className)}
      title="Unverified account — reduced visibility"
    >
      <ShieldAlert className={iconClass} aria-hidden />
      {label ?? 'Unverified'}
    </Badge>
  );
}
