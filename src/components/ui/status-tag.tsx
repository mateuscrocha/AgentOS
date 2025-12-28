import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "error" | "neutral";

interface StatusTagProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

export function StatusTag({ variant, children, className }: StatusTagProps) {
  const colors =
    variant === "success"
      ? "bg-success/10 text-success"
      : variant === "warning"
      ? "bg-warning/10 text-warning"
      : variant === "error"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium",
        colors,
        className,
      )}
    >
      {children}
    </span>
  );
}

