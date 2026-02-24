import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterTriggerButtonProps = {
  onClick: () => void;
  label?: string;
  icon: LucideIcon;
  activeCount?: number;
  countLabel?: string;
  className?: string;
};

export function FilterTriggerButton({
  onClick,
  label = "Filtrar",
  icon: Icon,
  activeCount,
  countLabel,
  className,
}: FilterTriggerButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={cn("h-11 w-full justify-between rounded-xl border-border/80 bg-card/95", className)}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {typeof activeCount === "number" && activeCount > 0 ? (
        <Badge variant="secondary" className="h-6 px-2 text-[11px]">
          {countLabel ?? activeCount}
        </Badge>
      ) : null}
    </Button>
  );
}
