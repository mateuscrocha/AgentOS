import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface SectionHeaderProps {
  title: string;
  titleIcon?: ElementType;
  titleAddon?: ReactNode;
  subtitle?: string;
  subtitleIcon?: ElementType;
  subtitleClassName?: string;
  linkHref?: string;
  linkLabel?: string;
  linkClassName?: string;
  className?: string;
  helpText?: string;
  density?: "default" | "compact";
}

export function SectionHeader({ 
  title, 
  titleIcon: TitleIcon,
  titleAddon,
  subtitle,
  subtitleIcon: SubtitleIcon,
  subtitleClassName,
  linkHref, 
  linkLabel = "Ver mais",
  linkClassName,
  className,
  helpText,
  density = "default",
}: SectionHeaderProps) {
  const isCompact = density === "compact";

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        isCompact ? "mb-2" : "mb-4",
        className,
      )}
    >
      <div>
        <h3
          className={cn(
            "font-semibold text-card-foreground flex items-center",
            isCompact ? "text-sm gap-1" : "text-base gap-1.5",
          )}
        >
          {TitleIcon && (
            <span className={cn("inline-flex items-center justify-center rounded-md", isCompact ? "h-6 w-6 bg-secondary/60" : "h-7 w-7 bg-secondary/60")}>
              <TitleIcon className={cn("text-muted-foreground", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
            </span>
          )}
          {title}
          {titleAddon}
          {helpText && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
                  <HelpCircle className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {helpText}
              </TooltipContent>
            </Tooltip>
          )}
        </h3>
        {subtitle && (
          <p
            className={cn(
              "text-muted-foreground flex items-center",
              isCompact ? "text-[11px] mt-0 gap-1" : "text-xs mt-0.5 gap-1.5",
              subtitleClassName,
            )}
          >
            {SubtitleIcon && <SubtitleIcon className={cn(isCompact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
            <span>{subtitle}</span>
          </p>
        )}
      </div>
      {linkHref && (
        <Link 
          to={linkHref}
          className={cn(
            "flex items-center gap-1 transition-colors",
            isCompact ? "text-[11px]" : "text-xs",
            linkClassName ?? "text-primary hover:underline",
          )}
        >
          {linkLabel}
          <ChevronRight className={cn(isCompact ? "h-3 w-3" : "h-3 w-3")} />
        </Link>
      )}
    </div>
  );
}
