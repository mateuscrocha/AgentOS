import { LucideIcon, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InsightSeverity = 'info' | 'warning' | 'success';

interface InsightCardProps {
  title: string;
  description?: string;
  severity?: InsightSeverity;
  icon?: LucideIcon;
  className?: string;
  children?: React.ReactNode;
}

export function InsightCard({ 
  title, 
  description,
  severity = 'info',
  icon,
  className,
  children
}: InsightCardProps) {
  const getDefaultIcon = () => {
    switch (severity) {
      case 'warning': return AlertTriangle;
      case 'success': return CheckCircle2;
      default: return Info;
    }
  };

  const Icon = icon || getDefaultIcon();

  const getSeverityStyles = () => {
    switch (severity) {
      case 'warning':
        return 'border-warning/30 bg-warning/5';
      case 'success':
        return 'border-success/30 bg-success/5';
      default:
        return 'border-primary/20 bg-primary/5';
    }
  };

  const getIconStyles = () => {
    switch (severity) {
      case 'warning':
        return 'text-warning';
      case 'success':
        return 'text-success';
      default:
        return 'text-primary';
    }
  };

  return (
    <div className={cn(
      "rounded-xl border p-4",
      getSeverityStyles(),
      className
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5", getIconStyles())}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-card-foreground">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          {children && (
            <div className="mt-3">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}
