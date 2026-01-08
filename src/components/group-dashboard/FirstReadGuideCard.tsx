import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Sparkles, Users, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type GuideItem = {
  title: string;
  description: string;
  icon?: LucideIcon;
};

type FirstReadGuideCardProps = {
  storageKey: string;
  className?: string;
  title?: string;
  introLine1?: string;
  introLine2?: string;
  items?: GuideItem[];
  ctaLabel?: string;
  forceVisible?: boolean;
  onDismiss?: () => void;
};

export function FirstReadGuideCard({
  storageKey,
  className,
  title = "Primeira leitura do seu grupo",
  introLine1 = "Este painel mostra sinais do que acontece no grupo.",
  introLine2 = "Se for a primeira vez aqui, comece por estes três pontos:",
  items,
  ctaLabel = "Entendi, pode esconder",
  forceVisible,
  onDismiss,
}: FirstReadGuideCardProps) {
  const defaultItems = useMemo<GuideItem[]>(
    () => [
      {
        title: "Momento de pico",
        description: "Veja quando o grupo ficou mais ativo e o que estava acontecendo naquele horário.",
        icon: Zap,
      },
      {
        title: "Participação das pessoas",
        description: "Observe se a conversa está distribuída ou concentrada em poucas pessoas.",
        icon: Users,
      },
      {
        title: "Leia como sinal, não como regra",
        description: "Os dados mostram padrões. O valor está em entender o movimento, não em controlar a conversa.",
        icon: Eye,
      },
    ],
    [],
  );

  const resolvedItems = items && items.length > 0 ? items : defaultItems;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (forceVisible) return false;
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (forceVisible) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey, forceVisible]);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      void 0;
    }
    onDismiss?.();
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-b from-primary/10 via-card to-card p-5 shadow-sm ring-1 ring-primary/10 transition-all animate-in fade-in-0 slide-in-from-top-2 duration-300 hover:shadow-md hover:ring-primary/20",
        className,
      )}
      aria-label={title}
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary to-primary/20" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_circle_at_15%_0%,hsl(var(--primary)_/_0.20),transparent_60%)]"
        aria-hidden="true"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20 shadow-sm">
              <Sparkles className="h-4 w-4 transition-transform duration-200" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold text-card-foreground leading-tight">{title}</div>
              <p className="text-sm text-muted-foreground max-w-[80ch] leading-relaxed">
                {introLine1}
                <br />
                {introLine2}
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="shrink-0 border border-primary/15 bg-primary/10 text-primary">
            Guia rápido
          </Badge>
        </div>

        <ol className="mt-4 space-y-2">
          {resolvedItems.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <li
                key={`${item.title}-${index}`}
                className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 transition-colors hover:bg-card/70"
              >
                {ItemIcon ? (
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-foreground/80 ring-1 ring-border/60 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <ItemIcon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                ) : (
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-xs font-semibold text-foreground/80 ring-1 ring-border/60">
                    {index + 1}
                  </span>
                )}

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-card-foreground">{item.title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{item.description}</div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Leitura rápida para começar sem ansiedade.</p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-primary/20 bg-card/60 hover:bg-primary/10 hover:text-primary"
            onClick={handleDismiss}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {ctaLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
