import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton feed shown while the marketplace loads (Section 8.3 / 9.2). */
export default function MarketplaceLoading() {
  return (
    <div className="container py-6">
      <Skeleton className="mb-4 h-9 w-48" />
      <Skeleton className="mb-4 h-11 w-full" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
