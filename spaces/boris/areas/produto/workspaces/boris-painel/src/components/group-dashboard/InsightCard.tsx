import { LucideIcon, Info, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type InsightSeverity = 'info' | 'warning' | 'success';

interface InsightCardProps {
  title: string;
  description?: string;
  severity?: InsightSeverity;
  icon?: LucideIcon;
  className?: string;
  children?: React.ReactNode;
  helpText?: string;
}

export function InsightCard({ 
  title, 
  description,
  severity = 'info',
  icon,
  className,
  children,
  helpText
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
        return 'border-warning/35 bg-warning/5 shadow-sm';
      case 'success':
        return 'border-success/35 bg-success/5 shadow-sm';
      default:
        return 'border-primary/25 bg-primary/5 shadow-sm';
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
          <p className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
            {title}
            {helpText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {helpText}
                </TooltipContent>
              </Tooltip>
            )}
          </p>
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
