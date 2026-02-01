import { Skeleton } from "@/components/ui/skeleton";

export default function NowLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="mt-4 h-5 w-32" />
            <Skeleton className="mt-2 h-3 w-48" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
        <Skeleton className="mt-2 h-4 w-5/6" />
      </div>
    </div>
  );
}
