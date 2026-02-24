import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Tag } from "lucide-react";

interface TopicBlock { label: string; key: string; terms: string[]; count: number; participants?: number }

interface TopicsKeywordsSectionProps {
  blocks?: TopicBlock[];
  previousBlocks?: TopicBlock[];
  isLoading?: boolean;
  periodLabel?: string;
  error?: string;
}

export function TopicsKeywordsSection({
  blocks = [],
  previousBlocks = [],
  isLoading,
  periodLabel = "período",
  error,
}: TopicsKeywordsSectionProps) {
  const items = (blocks || []).slice().sort((a, b) => b.count - a.count).slice(0, 10);
  const prevMap = new Map<string, number>((previousBlocks || []).map(b => [b.key, b.count]));
  const maxCount = items.length > 0 ? Math.max(...items.map(i => i.count)) : 0;

  const getTrend = (key: string, current: number) => {
    const prev = prevMap.get(key) || 0;
    if (prev === 0 && current === 0) return { label: "estável", type: "neutral" as const };
    if (prev === 0 && current > 0) return { label: "subindo", type: "positive" as const };
    const ratio = prev > 0 ? current / prev : 1;
    if (ratio >= 1.1) return { label: "subindo", type: "positive" as const };
    if (ratio <= 0.9) return { label: "caindo", type: "negative" as const };
    return { label: "estável", type: "neutral" as const };
  };

  const TrendChip = ({ label, type }: { label: string; type: "positive" | "negative" | "neutral" }) => {
    const Icon = type === "positive" ? TrendingUp : type === "negative" ? TrendingDown : Minus;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px]",
          type === "positive" && "text-success bg-success/10",
          type === "negative" && "text-destructive bg-destructive/10",
          type === "neutral" && "text-muted-foreground bg-muted/20"
        )}
      >
        <Icon className="h-3 w-3" />
        {label}
      </span>
    );
  };

  return (
    <section className="rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
            <Tag className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <SectionHeader
              title="Termos & Palavras-chave do Grupo"
              subtitle={`Principais termos identificados nas mensagens do período selecionado`}
              className="mb-0"
            />
          </div>
        </div>
        <div>
          <Button variant="ghost" size="sm" aria-label="Ver mais" onClick={() => void 0}>Ver mais termos</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/70 bg-card/80 p-3">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">Erro ao carregar termos. Tente novamente.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">Sem dados para este período.</p>
        </div>
      ) : (
        <ul className="mt-2 space-y-2" role="list">
          {items.map((b) => {
            const trend = getTrend(b.key, b.count);
            const width = maxCount > 0 ? Math.round((b.count / maxCount) * 100) : 0;
            return (
              <li key={b.key} className="rounded-lg border border-border/70 bg-card/80 p-3 hover:bg-secondary/35 transition-colors cursor-pointer" role="listitem" aria-label={b.label}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-semibold text-card-foreground truncate">{b.label}</span>
                    <TrendChip label={trend.label} type={trend.type} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{b.count} menções</span>
                </div>
                {b.terms && b.terms.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {b.terms.slice(0, 6).map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="text-[12px] font-semibold tracking-tight px-2.5 py-1 bg-secondary/60 text-foreground border border-border/70"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-2 h-2 w-full rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground">Baseado nas mensagens do período selecionado</p>
    </section>
  );
}
