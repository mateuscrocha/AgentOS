import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonMessageCard() {
  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="relative w-full max-w-[42rem]">
        <div className="absolute left-0 top-3 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border border-border/30 bg-card/80" />
        <div className="rounded-2xl rounded-tl-md border border-border/40 bg-card/80 px-3.5 py-3 shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-28" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          <div className="pt-3 flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
