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
  iconContainerClassName?: string;
  iconClassName?: string;
  numericValue?: boolean;
}

function formatDisplayValue(value: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("pt-BR");
  }

  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed).toLocaleString("pt-BR");
  }

  return value;
}

function buildKpiDescription(description: string | undefined, help: MetricHelpContent | undefined, title: string) {
  if (description?.trim()) return description.trim();

  const baseText = help?.whatIs?.trim() || `Resumo do KPI ${title}.`;
  const firstSentence = baseText.split(/(?<=[.!?])\s+/)[0] || baseText;
  const normalized = firstSentence.replace(/\s+/g, " ").trim();

  if (normalized.length <= 88) return normalized;
  return `${normalized.slice(0, 85).trimEnd()}...`;
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
  iconContainerClassName,
  iconClassName,
  numericValue = false,
}: StatsCardProps) {
  const Component = onClick ? 'button' : 'div';
  const componentProps = onClick ? ({ type: "button" } as const) : undefined;
  const resolvedHelp = help ?? buildMetricHelpFallback(title);
  const kpiDescription = buildKpiDescription(description, resolvedHelp, title);
  const formattedValue = formatDisplayValue(value);
  
  if (variant === "kpi") {
    return (
      <Component 
        {...componentProps}
        onClick={onClick}
        className={cn(
          "min-h-[132px] w-full rounded-[var(--radius-lg)] border border-border/80 bg-card/95 p-4 text-left shadow-subtle",
          onClick && "ripple-surface cursor-pointer transition-all hover:border-primary/20 hover:bg-secondary/20 hover:shadow-card hover:scale-[1.01] active:scale-[0.99]",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-primary/20 bg-primary/[0.08] shadow-subtle",
                iconContainerClassName,
              )}
            >
              <Icon className={cn("h-4 w-4 text-primary", iconClassName)} />
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
                "font-sans text-[1.35rem] sm:text-[1.95rem] font-semibold text-card-foreground tracking-[-0.03em] whitespace-nowrap max-w-[65%] sm:max-w-none truncate sm:overflow-visible sm:text-clip shrink-0 text-right",
                numericValue && "tabular-nums",
                valueClassName,
              )}
            >
              {formattedValue}
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
                  "mt-2 inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight",
                  changeType === "positive" && "bg-success/10 text-success",
                  changeType === "negative" && "bg-destructive/10 text-destructive",
                  changeType === "neutral" && "border-border/70 bg-muted/40 text-muted-foreground"
                )}
              >
                {change}
              </p>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/90">{kpiDescription}</p>
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
            <p className={cn("text-xl font-semibold text-card-foreground", valueClassName)}>{formattedValue}</p>
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
              <p className={cn("mt-2 text-3xl font-bold text-card-foreground", valueClassName)}>{formattedValue}</p>
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
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/10",
            iconContainerClassName,
          )}
        >
          <Icon className={cn("h-6 w-6 text-primary", iconClassName)} />
        </div>
      </div>
    </Component>
  );
}
