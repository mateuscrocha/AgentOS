import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricHelp, type MetricHelpContent } from "@/components/ui/metric-help";
import { buildMetricHelpFallback } from "@/components/ui/metric-help-fallback";

interface StatsCardProps {
  title: string;
  value: string | number;
  help?: MetricHelpContent;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  description?: string;
  onClick?: () => void;
  isLoading?: boolean;
  variant?: "default" | "compact" | "kpi";
  className?: string;
  titleClassName?: string;
  valueClassName?: string;
  numericValue?: boolean;
}

export function StatsCard({ 
  title, 
  value, 
  help,
  change, 
  changeType = "neutral", 
  icon: Icon,
  description,
  onClick,
  isLoading = false,
  variant = "default",
  className,
  titleClassName,
  valueClassName,
  numericValue = false,
}: StatsCardProps) {
  const Component = onClick ? 'button' : 'div';
  const componentProps = onClick ? ({ type: "button" } as const) : undefined;
  const resolvedHelp = help ?? buildMetricHelpFallback(title);
  
  if (variant === "kpi") {
    return (
      <Component 
        {...componentProps}
        onClick={onClick}
        className={cn(
          "rounded-xl border border-border/70 bg-card p-4 shadow-none text-left w-full min-h-[128px]",
          onClick && "ripple-surface cursor-pointer transition-all hover:border-primary/20 hover:bg-secondary/20 hover:scale-[1.01] active:scale-[0.99]",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08]">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-start gap-1 min-w-0">
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.08em] leading-snug text-muted-foreground/90 line-clamp-2", titleClassName)}>{title}</p>
              {resolvedHelp ? (
                <MetricHelp metricTitle={title} {...resolvedHelp} className="h-4 w-4 shrink-0" />
              ) : null}
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-9 w-20 shrink-0" />
          ) : (
            <p
              className={cn(
                "text-2xl sm:text-[2.1rem] font-semibold text-card-foreground tracking-tight tabular-nums whitespace-nowrap max-w-[65%] sm:max-w-none truncate sm:overflow-visible sm:text-clip shrink-0 text-right",
                numericValue && "font-mono text-[1.35rem] sm:text-[1.95rem]",
                valueClassName,
              )}
            >
              {value}
            </p>
          )}
        </div>
        {isLoading ? (
          <div className="mt-2">
            <Skeleton className="h-3 w-28" />
          </div>
        ) : (
          <>
            {change && (
              <p
                className={cn(
                  "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  changeType === "positive" && "bg-success/10 text-success",
                  changeType === "negative" && "bg-destructive/10 text-destructive",
                  changeType === "neutral" && "bg-muted/40 text-muted-foreground"
                )}
              >
                {change}
              </p>
            )}
            {description && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/90">{description}</p>
            )}
          </>
        )}
      </Component>
    );
  }

  if (variant === "compact") {
    return (
      <Component 
        {...componentProps}
        onClick={onClick}
        className={cn(
          "rounded-md border border-border/80 bg-card/95 p-3 shadow-none text-left w-full h-[64px]",
          onClick && "ripple-surface cursor-pointer transition-colors transition-transform hover:bg-secondary/35 hover:scale-[1.02] active:scale-[0.99]",
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            <p className={cn("text-xs font-medium text-muted-foreground", titleClassName)}>{title}</p>
            {resolvedHelp ? (
              <MetricHelp metricTitle={title} {...resolvedHelp} className="h-4 w-4 shrink-0" />
            ) : null}
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-14" />
          ) : (
            <p className={cn("text-xl font-semibold text-card-foreground", valueClassName)}>{value}</p>
          )}
        </div>
      </Component>
    );
  }

  return (
    <Component
      {...componentProps}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border/80 bg-card/95 p-6 shadow-card animate-fade-in text-left w-full",
        onClick && "ripple-surface cursor-pointer transition-colors transition-transform hover:bg-secondary/35 hover:scale-[1.02] active:scale-[0.99]",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1 min-w-0">
            <p className={cn("text-sm font-medium text-muted-foreground", titleClassName)}>{title}</p>
            {resolvedHelp ? (
              <MetricHelp metricTitle={title} {...resolvedHelp} className="h-4 w-4 shrink-0" />
            ) : null}
          </div>
          {isLoading ? (
            <>
              <div className="mt-2">
                <Skeleton className="h-9 w-24" />
              </div>
              <div className="mt-2">
                <Skeleton className="h-4 w-32" />
              </div>
            </>
          ) : (
            <>
              <p className={cn("mt-2 text-3xl font-bold text-card-foreground", valueClassName)}>{value}</p>
              {change && (
                <p className={cn(
                  "mt-1 text-sm font-medium",
                  changeType === "positive" && "text-success",
                  changeType === "negative" && "text-destructive",
                  changeType === "neutral" && "text-muted-foreground"
                )}>
                  {change}
                </p>
              )}
              {description && (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              )}
            </>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Component>
  );
}
