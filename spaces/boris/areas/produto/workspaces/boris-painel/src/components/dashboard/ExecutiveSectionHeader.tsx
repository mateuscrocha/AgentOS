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
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.12em]",
              eyebrowTone === "primary" ? "text-primary/85" : "text-muted-foreground",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center gap-2.5">
          {Icon ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-border/70 bg-muted/30 shadow-subtle">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
          ) : null}
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-card-foreground sm:text-xl">
            {title}
          </h3>
        </div>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}
