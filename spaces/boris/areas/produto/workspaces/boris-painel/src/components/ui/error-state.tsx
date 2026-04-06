import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({ 
  title = "Erro ao carregar dados",
  message = "Ocorreu um erro inesperado. Tente novamente.",
  retry,
  className 
}: ErrorStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-destructive/15 bg-destructive/[0.035] px-4 py-12 text-center",
      className
    )}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <h3 className="mb-1 text-lg font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">{message}</p>
      {retry && (
        <Button type="button" variant="secondary" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
