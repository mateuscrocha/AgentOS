import { Separator } from "@/components/ui/separator";

export function SectionDivider({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        {subtitle ? <div className="text-xs text-muted-foreground/80">{subtitle}</div> : null}
      </div>
      <Separator className="flex-1 bg-border/60" />
    </div>
  );
}

