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
        "inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-medium tracking-[0.01em]",
        colors,
        variant === "success" && "border-success/15",
        variant === "warning" && "border-warning/15",
        variant === "error" && "border-destructive/15",
        variant === "neutral" && "border-border/70",
        className,
      )}
    >
      {children}
    </span>
  );
}
