import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { cn } from "@/lib/utils";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type NotifyOpts = {
  duration?: number;
};

type NotifyType = "success" | "error" | "warning" | "info";

const DEFAULT_DURATION_MS: Record<NotifyType, number> = {
  success: 3500,
  info: 3500,
  warning: 5000,
  error: 10000,
};

function show(type: NotifyType, title: string, description?: string, opts?: NotifyOpts) {
  const duration = opts?.duration ?? DEFAULT_DURATION_MS[type];

  switch (type) {
    case "success":
      return toast.success(title, { description, duration });
    case "info":
      return toast.info(title, { description, duration });
    case "warning":
      return toast.warning(title, { description, duration });
    case "error":
      return toast.error(title, { description, duration });
  }
}

export const notify = {
  success: (title: string, description?: string, opts?: NotifyOpts) => show("success", title, description, opts),
  error: (title: string, description?: string, opts?: NotifyOpts) => show("error", title, description, opts),
  warning: (title: string, description?: string, opts?: NotifyOpts) => show("warning", title, description, opts),
  info: (title: string, description?: string, opts?: NotifyOpts) => show("info", title, description, opts),
};

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      visibleToasts={3}
      closeButton
      richColors={false}
      offset={{
        right: "calc(env(safe-area-inset-right, 0px) + 16px)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
      }}
      mobileOffset={{
        right: "calc(env(safe-area-inset-right, 0px) + 12px)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        left: "calc(env(safe-area-inset-left, 0px) + 12px)",
      }}
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-success" />,
        info: <Info className="h-4 w-4 text-muted-foreground" />,
        warning: <AlertTriangle className="h-4 w-4 text-warning" />,
        error: <XCircle className="h-4 w-4 text-destructive" />,
        close: <X className="h-4 w-4" />,
      }}
      toastOptions={{
        classNames: {
          toast: cn(
            "group pointer-events-auto relative w-full max-w-[420px] overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-card",
            "px-4 py-3 pr-10",
          ),
          title: "text-sm font-medium leading-5",
          description: "text-sm leading-5 text-muted-foreground",
          icon: "mt-0.5",
          closeButton: cn(
            "absolute right-2 top-2 rounded-md p-1 text-muted-foreground/70",
            "opacity-0 transition-opacity group-hover:opacity-100",
            "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
          ),
          success: "border-l-2 border-l-success/40",
          info: "border-l-2 border-l-muted-foreground/20",
          warning: "border-l-2 border-l-warning/35",
          error: "border-l-2 border-l-destructive/40",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
