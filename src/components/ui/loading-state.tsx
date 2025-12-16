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
      "flex flex-col items-center justify-center py-12 px-4",
      className
    )}>
      <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
