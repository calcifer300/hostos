import { CardSkeleton, Skeleton, StatSkeleton } from "@/components/ui/skeleton";

/**
 * Shown inside the shell while a product page's server render is in flight.
 * Shaped like a dashboard — header, a row of numbers, a grid of cards — which
 * is close enough to every page that the swap to real content is quiet.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-64" />
          <Skeleton className="mt-3 h-3.5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-6">
        <CardSkeleton className="lg:col-span-3" lines={5} />
        <CardSkeleton className="lg:col-span-3" lines={5} />
        <CardSkeleton className="lg:col-span-2" lines={4} />
        <CardSkeleton className="lg:col-span-2" lines={4} />
        <CardSkeleton className="lg:col-span-2" lines={4} />
      </div>
    </div>
  );
}
