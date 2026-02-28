import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function isInteractiveTarget(target: EventTarget | null, container: HTMLElement) {
  if (!(target instanceof HTMLElement)) return false;
  if (target === container) return false;
  return !!target.closest(
    'button, a, input, select, textarea, [role="button"], [role="menuitem"], [contenteditable="true"]',
  );
}

export interface BorisColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  headerIcon?: React.ReactNode;
  align?: "left" | "right" | "center";
  hideOn?: "sm" | "md" | "lg";
}

interface BorisTableProps<T> {
  columns: BorisColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  loading?: boolean;
  error?: string | boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
  skeletonWidths?: (number | string)[];
  rowClassName?: (item: T) => string | undefined;
  density?: "default" | "comfortable";
}

export function BorisTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  page = 1,
  pageSize = 10,
  totalCount,
  onPageChange,
  className,
  loading,
  error,
  onRetry,
  emptyMessage = "Nenhum registro encontrado.",
  emptyIcon,
  skeletonWidths,
  rowClassName,
  density = "default",
}: BorisTableProps<T>) {
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1;
  const showPagination = totalCount && totalCount > pageSize;

  const headerCls = cn(
    "px-4 text-left text-[13px] font-semibold text-foreground/75",
    density === "comfortable" ? "py-3.5" : "py-3",
  );
  const cellBaseCls = cn(
    "px-4 text-[14px] font-normal text-card-foreground",
    density === "comfortable" ? "py-3" : "py-2",
  );

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
        <div className="border-b border-border p-4 flex gap-4">
          {columns.map((_, i) => (
            <div key={i} className="flex items-center gap-1">
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        {[...Array(5)].map((_, rowIdx) => (
          <div key={rowIdx} className="border-b border-border p-4 flex gap-4 last:border-0">
            {columns.map((_, colIdx) => {
              const w = skeletonWidths?.[colIdx];
              const style = w ? (typeof w === "number" ? { width: `${w}px` } : { width: w }) : undefined;
              return <Skeleton key={colIdx} className="h-4 w-24" style={style} />;
            })}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar os dados."
        message="Não foi possível carregar os dados. Tente novamente."
        retry={onRetry}
      />
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState icon={emptyIcon} title={"Nenhum registro encontrado"} message={emptyMessage} />;
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(headerCls, col.className, col.align === "right" && "text-right", col.align === "center" && "text-center", col.hideOn === "sm" && "hidden sm:table-cell", col.hideOn === "md" && "hidden md:table-cell", col.hideOn === "lg" && "hidden lg:table-cell")}
                >
                  <div className="inline-flex items-center gap-1">
                    {col.headerIcon}
                    <span>{col.header}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                onKeyDown={(e) => {
                  if (!onRowClick) return;
                  if (isInteractiveTarget(e.target, e.currentTarget)) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(item);
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  "transition-colors",
                  density === "comfortable" ? "min-h-[72px]" : "h-11",
                  onRowClick && "cursor-pointer hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  rowClassName?.(item),
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      cellBaseCls,
                      col.className,
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.hideOn === "sm" && "hidden sm:table-cell",
                      col.hideOn === "md" && "hidden md:table-cell",
                      col.hideOn === "lg" && "hidden lg:table-cell",
                    )}
                  >
                    {col.render
                      ? col.render(item)
                      : ((item as Record<string, unknown>)[col.key] as any)?.toString?.() ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && onPageChange && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/20">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages} • {totalCount} itens
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Próxima página"
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors ml-auto"
          aria-label="Ações"
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
