import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ExecutiveSectionHeaderProps {
  eyebrow?: string;
  eyebrowTone?: "default" | "primary";
  title: string;
  description?: string;
  icon?: ElementType;
  badge?: ReactNode;
  className?: string;
}

export function ExecutiveSectionHeader({
  eyebrow,
  eyebrowTone = "default",
  title,
  description,
  icon: Icon,
  badge,
  className,
}: ExecutiveSectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.1em]",
              eyebrowTone === "primary" ? "text-primary/85" : "text-muted-foreground",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          {Icon ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-muted/20">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
          ) : null}
          <h3 className="text-base font-semibold tracking-tight text-card-foreground sm:text-lg">
            {title}
          </h3>
        </div>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}
