import { Skeleton } from '@/components/ui/skeleton';

/** Listing detail skeleton — instant feedback while the item loads. */
export default function ListingLoading() {
  return (
    <div className="container grid gap-8 py-6 md:grid-cols-2">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-7 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-11 w-32" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}
