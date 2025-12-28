import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { cn } from "@/lib/utils";

type NotifyOpts = {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
};

type NotifyType = "success" | "error" | "warning" | "info";

const icons: Record<NotifyType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ⓘ",
};

const styles: Record<NotifyType, { bg: string; title: string; icon: string; border: string }> = {
  success: { bg: "bg-success/10", title: "text-success", icon: "text-success", border: "border-success/20" },
  error: { bg: "bg-destructive/10", title: "text-destructive", icon: "text-destructive", border: "border-destructive/20" },
  warning: { bg: "bg-warning/10", title: "text-warning", icon: "text-warning", border: "border-warning/20" },
  info: { bg: "bg-blue-50", title: "text-blue-700", icon: "text-blue-700", border: "border-blue-200" },
};

function show(type: NotifyType, title: string, message: string, opts?: NotifyOpts) {
  const s = styles[type];
  return toast.custom(
    () => (
      <div
        className={cn(
          "flex items-start gap-3 max-w-[460px] p-4 rounded-xl shadow-lg border",
          s.bg,
          s.border,
        )}
      >
        <div className={cn("shrink-0 text-[20px] leading-5", s.icon)}>{icons[type]}</div>
        <div className="flex-1">
          <div className={cn("text-[14px] font-semibold", s.title)}>{title}</div>
          <div className="text-[13px] text-muted-foreground">{message}</div>
          {opts?.actionLabel && opts?.onAction ? (
            <button
              onClick={opts.onAction}
              className="mt-2 text-[13px] font-medium underline"
            >
              {opts.actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    ),
    {
      duration: opts?.duration ?? 5000,
    },
  );
}

export const notify = {
  success: (title: string, message: string, opts?: NotifyOpts) => show("success", title, message, opts),
  error: (title: string, message: string, opts?: NotifyOpts) => show("error", title, message, opts),
  warning: (title: string, message: string, opts?: NotifyOpts) => show("warning", title, message, opts),
  info: (title: string, message: string, opts?: NotifyOpts) => show("info", title, message, opts),
};

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      duration={5000}
      closeButton
      {...props}
    />
  );
};

export { Toaster, toast };
