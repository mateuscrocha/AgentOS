import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ElementType;
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ 
  icon: Icon = Inbox,
  title = "Nenhum item encontrado",
  message = "Não há dados para exibir no momento.",
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border bg-card/70 px-4 py-12 text-center",
      className
    )}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="mb-1 text-lg font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">{message}</p>
      {action && (
        <Button type="button" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
