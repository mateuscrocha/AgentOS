import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
  };
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({ 
  title, 
  value, 
  icon: Icon, 
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

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-card",
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {Icon && <Icon className="h-4 w-4 text-primary" />}
      </div>
      
      {isLoading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="space-y-1">
          <p className="text-2xl font-bold text-card-foreground">{value}</p>
          {trend && (
            <div className={cn("flex items-center gap-1 text-xs", getTrendColor())}>
              {TrendIcon && <TrendIcon className="h-3 w-3" />}
              <span>
                {trend.value > 0 ? '+' : ''}{trend.value}%
                {trend.label && <span className="text-muted-foreground ml-1">{trend.label}</span>}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
