import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DiaryPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="rounded-[var(--radius-lg)] border border-border/80 bg-card/95 p-4 shadow-subtle">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden md:block">
          <Card className="rounded-[var(--radius-xl)] border border-border/80 bg-card/95 p-4 shadow-subtle sm:p-5">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="mt-4 space-y-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-3 py-3 shadow-subtle">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-24" />
                    <div className="flex gap-1">
                      <Skeleton className="h-1.5 w-5 rounded-full" />
                      <Skeleton className="h-1.5 w-5 rounded-full" />
                      <Skeleton className="h-1.5 w-5 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className="mt-2 h-3 w-36" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-7">
          <Card className="rounded-[var(--radius-xl)] border border-primary/15 bg-gradient-to-br from-primary/[0.05] via-card/95 to-card/95 px-7 py-8 shadow-subtle sm:px-10 sm:py-10">
            <div className="space-y-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full max-w-[720px]" />
              <Skeleton className="h-4 w-full max-w-[820px]" />
              <Skeleton className="h-4 w-5/6 max-w-[760px]" />
            </div>
          </Card>

          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="flex-1">
                <Skeleton className="h-px w-full" />
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Card key={idx} className="rounded-[var(--radius-lg)] border border-border/80 bg-card/95 p-4 shadow-subtle sm:p-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
