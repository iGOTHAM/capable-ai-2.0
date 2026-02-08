import { Skeleton } from "@/components/ui/skeleton";

export default function DocsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex h-[calc(100vh-12rem)] overflow-hidden rounded-lg border">
        {/* Sidebar skeleton */}
        <div className="w-64 shrink-0 border-r p-3">
          <Skeleton className="mb-3 h-8 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-6 w-full" />
          ))}
        </div>

        {/* Viewer skeleton */}
        <div className="flex-1 p-4">
          <Skeleton className="mb-4 h-6 w-48" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-2 h-4 w-3/4" />
          <Skeleton className="mb-2 h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}
