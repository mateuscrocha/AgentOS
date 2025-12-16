import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  className?: string;
  variant?: "cards" | "table" | "detail";
}

export function PageSkeleton({ className, variant = "cards" }: PageSkeletonProps) {
  if (variant === "table") {
    return (
      <div className={cn("space-y-4 animate-pulse", className)}>
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-muted rounded-lg" />
          <div className="h-10 w-32 bg-muted rounded-lg" />
        </div>
        
        {/* Table skeleton */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border p-4 flex gap-4">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded ml-auto" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-border p-4 flex gap-4 last:border-0">
              <div className="h-4 w-24 bg-muted/50 rounded" />
              <div className="h-4 w-32 bg-muted/50 rounded" />
              <div className="h-4 w-20 bg-muted/50 rounded" />
              <div className="h-4 w-16 bg-muted/50 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={cn("space-y-6 animate-pulse", className)}>
        {/* Breadcrumb skeleton */}
        <div className="flex gap-2 items-center">
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
        
        {/* Header card skeleton */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 bg-muted rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted/50 rounded" />
            </div>
            <div className="h-10 w-24 bg-muted rounded-lg" />
          </div>
        </div>
        
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="h-4 w-20 bg-muted/50 rounded mb-2" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
        
        {/* Content skeleton */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-5 w-32 bg-muted rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 bg-muted/30 rounded" style={{ width: `${80 - i * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  // Default: cards variant
  return (
    <div className={cn("space-y-6 animate-pulse", className)}>
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-8 w-8 bg-muted rounded-lg" />
            </div>
            <div className="h-8 w-16 bg-muted rounded mb-1" />
            <div className="h-3 w-24 bg-muted/50 rounded" />
          </div>
        ))}
      </div>
      
      {/* Content cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="h-5 w-32 bg-muted rounded" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-10 w-10 bg-muted/50 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-3/4 bg-muted/50 rounded" />
                  <div className="h-3 w-1/2 bg-muted/30 rounded" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
