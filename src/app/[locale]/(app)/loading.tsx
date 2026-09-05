import { Skeleton } from '@/components/ui/skeleton';

/**
 * Generic instant-navigation skeleton for app pages that don't ship their own
 * loading state. Keeps the persistent chrome (header/nav) and shows a neutral
 * content placeholder so navigation feels instant even on dynamic routes — and
 * lets Next prefetch the loading state on hover/viewport.
 */
export default function AppLoading() {
  return (
    <div className="container space-y-4 py-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
