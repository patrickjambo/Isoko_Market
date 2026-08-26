import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRating({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5`}
    >
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              'h-4 w-4',
              i <= rounded
                ? 'fill-accent text-accent'
                : 'fill-transparent text-muted-foreground/40'
            )}
            aria-hidden
          />
        ))}
      </div>
      {typeof count === 'number' && (
        <span className="text-sm text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
