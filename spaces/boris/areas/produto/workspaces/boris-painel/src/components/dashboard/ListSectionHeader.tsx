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
    <div className={cn("rounded-[20px] border border-border/80 bg-card/95 px-4 py-3 shadow-subtle", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </span>
          <Badge variant="secondary" className="tabular-nums border-border/80 bg-background/80 font-semibold text-foreground">
            {count}
          </Badge>
          {isLoading ? loadingIndicator : null}
        </div>
        {statusLabel ? <p className="text-[12px] font-medium text-muted-foreground">{statusLabel}</p> : null}
      </div>
    </div>
  );
}
