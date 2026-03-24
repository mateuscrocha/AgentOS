import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
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
  sortable?: boolean;
  sortValue?: (item: T) => string | number | boolean | Date | null | undefined;
  sortComparator?: (a: T, b: T) => number;
}

export interface BorisSortState {
  key: string;
  direction: "asc" | "desc";
}

interface BorisTableProps<T> {
  columns: BorisColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: React.Dispatch<React.SetStateAction<number>>;
  className?: string;
  loading?: boolean;
  error?: string | boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
  skeletonWidths?: (number | string)[];
  rowClassName?: (item: T) => string | undefined;
  density?: "default" | "comfortable";
  sortState?: BorisSortState | null;
  defaultSortState?: BorisSortState | null;
  onSortChange?: (sort: BorisSortState | null) => void;
  sortMode?: "client" | "manual";
}

function comparePrimitiveValues(a: string | number | boolean | Date | null | undefined, b: string | number | boolean | Date | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const left = a instanceof Date ? a.getTime() : a;
  const right = b instanceof Date ? b.getTime() : b;

  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);

  return String(left).localeCompare(String(right), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
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
  sortState,
  defaultSortState = null,
  onSortChange,
  sortMode = "client",
}: BorisTableProps<T>) {
  const [internalSortState, setInternalSortState] = useState<BorisSortState | null>(defaultSortState);
  const activeSortState = sortState ?? internalSortState;
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1;
  const showPagination = totalCount && totalCount > pageSize;

  const headerCls = cn(
    "px-4 text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground",
    density === "comfortable" ? "py-3.5" : "py-3",
  );
  const cellBaseCls = cn(
    "px-4 text-[13px] font-normal text-card-foreground",
    density === "comfortable" ? "py-3" : "py-2",
  );
  const sortedData = useMemo(() => {
    if (sortMode === "manual" || !activeSortState) return data;

    const sortColumn = columns.find((column) => column.key === activeSortState.key && column.sortable);
    if (!sortColumn) return data;

    const directionFactor = activeSortState.direction === "asc" ? 1 : -1;
    return [...data].sort((left, right) => {
      const comparison = sortColumn.sortComparator
        ? sortColumn.sortComparator(left, right)
        : comparePrimitiveValues(
            sortColumn.sortValue ? sortColumn.sortValue(left) : ((left as Record<string, unknown>)[sortColumn.key] as any),
            sortColumn.sortValue ? sortColumn.sortValue(right) : ((right as Record<string, unknown>)[sortColumn.key] as any),
          );

      return comparison * directionFactor;
    });
  }, [activeSortState, columns, data, sortMode]);

  const updateSortState = (nextSortState: BorisSortState | null) => {
    if (sortState === undefined) {
      setInternalSortState(nextSortState);
    }
    onSortChange?.(nextSortState);
  };

  const handleSortToggle = (column: BorisColumn<T>) => {
    if (!column.sortable) return;

    if (activeSortState?.key !== column.key) {
      updateSortState({ key: column.key, direction: "asc" });
      return;
    }

    if (activeSortState.direction === "asc") {
      updateSortState({ key: column.key, direction: "desc" });
      return;
    }

    updateSortState(null);
  };

  if (loading) {
    return (
      <div className={cn("overflow-hidden rounded-[var(--radius-lg)] border border-border/80 bg-card/95 shadow-subtle", className)}>
        <div className="flex gap-4 border-b border-border bg-muted/25 p-4">
          {columns.map((_, i) => (
            <div key={i} className="flex items-center gap-1">
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        {[...Array(5)].map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-4 border-b border-border p-4 last:border-0">
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
    <div className={cn("overflow-hidden rounded-[var(--radius-lg)] border border-border/80 bg-card/95 shadow-subtle", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/35">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(headerCls, col.className, col.align === "right" && "text-right", col.align === "center" && "text-center", col.hideOn === "sm" && "hidden sm:table-cell", col.hideOn === "md" && "hidden md:table-cell", col.hideOn === "lg" && "hidden lg:table-cell")}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSortToggle(col)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-[var(--radius-sm)] text-inherit transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        col.align === "right" && "ml-auto",
                        col.align === "center" && "mx-auto",
                        activeSortState?.key === col.key && "text-foreground",
                      )}
                      aria-label={`Ordenar por ${col.header}`}
                    >
                      {col.headerIcon}
                      <span>{col.header}</span>
                      {activeSortState?.key === col.key ? (
                        activeSortState.direction === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/80" />
                      )}
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      {col.headerIcon}
                      <span>{col.header}</span>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedData.map((item) => (
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
                  onRowClick && "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
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
        <div className="flex items-center justify-between border-t border-border bg-muted/25 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages} • {totalCount} itens
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onPageChange((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              aria-label="Página anterior"
              className="rounded-[var(--radius-md)] border border-transparent p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              aria-label="Próxima página"
              className="rounded-[var(--radius-md)] border border-transparent p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
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
          className="ml-auto rounded-[var(--radius-md)] p-1.5 transition-colors hover:bg-muted"
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
