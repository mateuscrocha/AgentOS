import { LucideIcon, TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  helpText?: string;
  valueClassName?: string;
  trend?: {
    value: number;
    label?: string;
    isAbsolute?: boolean; // For absolute change display (+3 instead of +3%)
  };
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  helpText,
  valueClassName,
  trend, 
  isLoading,
  className 
}: KpiCardProps) {
  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return 'text-success';
    if (trend.value < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return TrendingUp;
    if (trend.value < 0) return TrendingDown;
    return Minus;
  };

  const TrendIcon = getTrendIcon();

  const formatTrendValue = () => {
    if (!trend) return '';
    const prefix = trend.value > 0 ? '+' : '';
    const suffix = trend.isAbsolute ? '' : '%';
    return `${prefix}${trend.value}${suffix}`;
  };

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-card",
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {helpText && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {helpText}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {Icon && <Icon className="h-4 w-4 text-primary" />}
      </div>
      
      {isLoading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="space-y-1">
          <p className={cn("text-2xl font-bold", valueClassName || "text-card-foreground")}>{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className={cn("flex items-center gap-1 text-xs", getTrendColor())}>
              {TrendIcon && <TrendIcon className="h-3 w-3" />}
              <span>
                {formatTrendValue()}
                {trend.label && <span className="text-muted-foreground ml-1">{trend.label}</span>}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
