import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Board skeleton */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-[280px] flex-col rounded-lg border border-t-2 bg-muted/30 p-3"
          >
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            {Array.from({ length: 2 + i }).map((_, j) => (
              <Skeleton key={j} className="mb-2 h-20 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
