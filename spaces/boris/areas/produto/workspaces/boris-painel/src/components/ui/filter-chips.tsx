import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterChipItem = {
  key: string;
  label: string;
  onRemove?: () => void;
  ariaLabel?: string;
};

type FilterChipsProps = {
  items: FilterChipItem[];
  onClearAll?: () => void;
  clearLabel?: string;
  className?: string;
};

export function FilterChips({
  items,
  onClearAll,
  clearLabel = "Limpar filtros",
  className,
}: FilterChipsProps) {
  if (!items.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {items.map((item) => (
        <Badge key={item.key} variant="secondary" className="h-7 gap-1 rounded-full px-2.5">
          <span className="max-w-[220px] truncate">{item.label}</span>
          {item.onRemove ? (
            <button
              type="button"
              onClick={item.onRemove}
              className="rounded-sm hover:bg-secondary-foreground/10"
              aria-label={item.ariaLabel || `Remover filtro ${item.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </Badge>
      ))}

      {onClearAll ? (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearAll}>
          {clearLabel}
        </Button>
      ) : null}
    </div>
  );
}
