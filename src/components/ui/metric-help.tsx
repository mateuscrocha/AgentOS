import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MetricHelpContent = {
  whatIs: string;
  howToInterpret: string;
  whatToObserve?: string;
  groupContext?: string;
};

type MetricHelpProps = MetricHelpContent & {
  metricTitle: string;
  className?: string;
  contentClassName?: string;
};

export function MetricHelp({
  metricTitle,
  whatIs,
  howToInterpret,
  whatToObserve,
  groupContext,
  className,
  contentClassName,
}: MetricHelpProps) {
  const [open, setOpen] = useState(false);
  const openModeRef = useRef<"hover" | "click" | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const requestCloseOnHoverExit = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      if (openModeRef.current === "hover") {
        setOpen(false);
        openModeRef.current = null;
      }
    }, 120);
  };

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      openModeRef.current = null;
      clearCloseTimeout();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ajuda sobre ${metricTitle}`}
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/80 hover:text-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          onClick={() => {
            openModeRef.current = "click";
            clearCloseTimeout();
          }}
          onMouseEnter={() => {
            if (openModeRef.current === "click") return;
            openModeRef.current = "hover";
            clearCloseTimeout();
            setOpen(true);
          }}
          onMouseLeave={() => {
            if (openModeRef.current !== "hover") return;
            requestCloseOnHoverExit();
          }}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        className={cn("w-[340px] max-w-[90vw] p-3", contentClassName)}
        onMouseEnter={() => {
          if (openModeRef.current !== "hover") return;
          clearCloseTimeout();
        }}
        onMouseLeave={() => {
          if (openModeRef.current !== "hover") return;
          requestCloseOnHoverExit();
        }}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground">O que é isso?</div>
            <div className="text-sm text-popover-foreground leading-relaxed">{whatIs}</div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground">Como interpretar</div>
            <div className="text-sm text-popover-foreground leading-relaxed">{howToInterpret}</div>
          </div>

          {whatToObserve ? (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-muted-foreground">O que observar</div>
              <div className="text-sm text-popover-foreground leading-relaxed">{whatToObserve}</div>
            </div>
          ) : null}

          {groupContext ? (
            <div className="rounded-md bg-muted/40 px-2.5 py-2">
              <div className="text-[11px] font-semibold text-muted-foreground">Neste grupo</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{groupContext}</div>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
