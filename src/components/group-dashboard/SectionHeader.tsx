import type { ElementType } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  subtitleIcon?: ElementType;
  subtitleClassName?: string;
  linkHref?: string;
  linkLabel?: string;
  linkClassName?: string;
  className?: string;
  helpText?: string;
}

export function SectionHeader({ 
  title, 
  subtitle,
  subtitleIcon: SubtitleIcon,
  subtitleClassName,
  linkHref, 
  linkLabel = "Ver mais",
  linkClassName,
  className,
  helpText,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div>
        <h3 className="text-base font-semibold text-card-foreground flex items-center gap-1.5">
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
        </h3>
        {subtitle && (
          <p className={cn("text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5", subtitleClassName)}>
            {SubtitleIcon && <SubtitleIcon className="h-3.5 w-3.5" />}
            <span>{subtitle}</span>
          </p>
        )}
      </div>
      {linkHref && (
        <Link 
          to={linkHref}
          className={cn(
            "flex items-center gap-1 text-xs transition-colors",
            linkClassName ?? "text-primary hover:underline",
          )}
        >
          {linkLabel}
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
