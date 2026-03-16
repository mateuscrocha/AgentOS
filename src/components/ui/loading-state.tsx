import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ 
  message = "Carregando...",
  className 
}: LoadingStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border bg-card/70 px-4 py-12",
      className
    )}>
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08]">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
