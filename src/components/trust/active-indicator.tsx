import { cn } from '@/lib/utils';

/** "Active today" dot — a first-class trust signal (Section 8.1). */
export function ActiveIndicator({
  active,
  label,
  className,
}: {
  active: boolean;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          active ? 'bg-success' : 'bg-muted-foreground/40'
        )}
        aria-hidden
      />
      <span className={active ? 'text-success' : 'text-muted-foreground'}>{label}</span>
    </span>
  );
}
