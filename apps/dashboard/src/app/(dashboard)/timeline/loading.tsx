import { Skeleton } from "@/components/ui/skeleton";

export default function TimelineLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32 font-mono" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="mt-2 h-3 w-40" />
          <div className="mt-4 flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-start gap-3 rounded-md border p-3">
                <Skeleton className="h-5 w-20 shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-1 h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
