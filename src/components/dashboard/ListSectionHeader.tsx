import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ListSectionHeaderProps {
  title: string;
  count: string | number;
  statusLabel?: string;
  isLoading?: boolean;
  loadingIndicator?: ReactNode;
  className?: string;
}

export function ListSectionHeader({
  title,
  count,
  statusLabel,
  isLoading = false,
  loadingIndicator,
  className,
}: ListSectionHeaderProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card px-4 py-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {title}
          </span>
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
          {isLoading ? loadingIndicator : null}
        </div>
        {statusLabel ? <p className="text-xs text-muted-foreground">{statusLabel}</p> : null}
      </div>
    </div>
  );
}
