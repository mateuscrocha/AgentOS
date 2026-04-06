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
      ? "bg-success/12 text-success"
      : variant === "warning"
      ? "bg-warning/12 text-warning"
      : variant === "error"
      ? "bg-destructive/12 text-destructive"
      : "bg-muted/80 text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold tracking-[0.01em] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]",
        colors,
        variant === "success" && "border-success/20",
        variant === "warning" && "border-warning/20",
        variant === "error" && "border-destructive/20",
        variant === "neutral" && "border-border/70",
        className,
      )}
    >
      {children}
    </span>
  );
}
