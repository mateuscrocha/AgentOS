import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  description?: string;
  onClick?: () => void;
  variant?: "default" | "compact" | "kpi";
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  changeType = "neutral", 
  icon: Icon,
  description,
  onClick,
  variant = "default"
}: StatsCardProps) {
  const Component = onClick ? 'button' : 'div';
  
  if (variant === "kpi") {
    return (
      <Component 
        onClick={onClick}
        className={cn(
          "rounded-md border border-border bg-card p-5 shadow-none text-left w-full h-[92px]",
          onClick && "hover:bg-secondary/50 transition-colors cursor-pointer"
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-4xl font-semibold text-card-foreground tracking-tight">{value}</p>
        </div>
      </Component>
    );
  }

  if (variant === "compact") {
    return (
      <Component 
        onClick={onClick}
        className={cn(
          "rounded-md border border-border bg-card p-3 shadow-none text-left w-full h-[64px]",
          onClick && "hover:bg-secondary/50 transition-colors cursor-pointer"
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold text-card-foreground">{value}</p>
        </div>
      </Component>
    );
  }

  return (
    <Component 
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in text-left w-full",
        onClick && "hover:bg-secondary/50 transition-colors cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-card-foreground">{value}</p>
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
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Component>
  );
}
