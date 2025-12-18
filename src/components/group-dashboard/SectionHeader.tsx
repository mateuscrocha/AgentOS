import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  linkHref?: string;
  linkLabel?: string;
  className?: string;
}

export function SectionHeader({ 
  title, 
  subtitle,
  linkHref, 
  linkLabel = "Ver mais",
  className 
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div>
        <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {linkHref && (
        <Link 
          to={linkHref}
          className="flex items-center gap-1 text-xs text-primary hover:underline transition-colors"
        >
          {linkLabel}
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
