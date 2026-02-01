import { Skeleton } from "@/components/ui/skeleton";

export default function DeployLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="mt-2 h-4 w-64" />
          <Skeleton className="mt-4 h-24 w-full" />
        </div>
      ))}
    </div>
  );
}
