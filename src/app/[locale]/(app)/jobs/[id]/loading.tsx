import { Skeleton } from '@/components/ui/skeleton';

/** Job detail skeleton — instant feedback while the posting loads. */
export default function JobLoading() {
  return (
    <div className="container max-w-3xl space-y-4 py-6">
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-36" />
        <Skeleton className="h-11 w-28" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
