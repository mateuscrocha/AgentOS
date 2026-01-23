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
  return (
    <section className={cn("space-y-4 mb-6", className)}>
      <div className="sticky top-16 z-20 -mx-6 px-6 py-3 bg-background/80 backdrop-blur border-b border-border">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>

      {generalKpis && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {generalKpis}
        </div>
      )}

      {filters && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3">{filters}</div>
            {showClearFilters && (
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                {clearFiltersLabel || "Limpar filtros"}
              </Button>
            )}
          </div>
        </div>
      )}

      {filteredKpis && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {filteredKpis}
        </div>
      )}
    </section>
  );
}
