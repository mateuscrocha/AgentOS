import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";

interface AdminPageHeaderProps {
  breadcrumbItems: BreadcrumbItem[];
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  generalKpis?: ReactNode;
  filters?: ReactNode;
  filteredKpis?: ReactNode;
  className?: string;
  showClearFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
}

export function AdminPageHeader({
  breadcrumbItems,
  title,
  description,
  actions,
  generalKpis,
  filters,
  filteredKpis,
  className,
  showClearFilters,
  onClearFilters,
  clearFiltersLabel,
}: AdminPageHeaderProps) {
  const hasTitleBlock = title != null || !!description || !!actions;

  return (
    <section className={cn("mb-6 space-y-5", className)}>
      <div className="pointer-events-none static z-20 -mx-4 border-b border-border/80 bg-background/80 px-4 py-3 backdrop-blur sm:sticky sm:top-16 sm:-mx-6 sm:px-6">
        <div className="pointer-events-auto">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      </div>

      {hasTitleBlock ? (
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 space-y-1">
            {title != null ? (
              <h2 className="text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[28px] sm:leading-8">{title}</h2>
            ) : null}
            {description && (
              <p className="max-w-3xl text-[13px] leading-5 text-muted-foreground sm:text-sm">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
          )}
        </div>
      ) : null}

      {generalKpis && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {generalKpis}
        </div>
      )}

      {filters && (
        <div className="rounded-[var(--radius-lg)] border border-border/80 bg-card/95 p-3 shadow-subtle">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">{filters}</div>
            {showClearFilters && onClearFilters && (
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                {clearFiltersLabel || "Limpar filtros"}
              </Button>
            )}
          </div>
        </div>
      )}

      {filteredKpis && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {filteredKpis}
        </div>
      )}
    </section>
  );
}
