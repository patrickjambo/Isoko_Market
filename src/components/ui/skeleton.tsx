import { cn } from '@/lib/utils';

/** Lightweight loading placeholder — used for feed skeleton states (Section 8.3). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-md', className)} {...props} />;
}

export { Skeleton };
