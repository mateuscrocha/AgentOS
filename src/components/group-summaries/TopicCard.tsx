import { Badge } from "@/components/ui/badge";
import { StatusTag } from "@/components/ui/status-tag";
import { cn } from "@/lib/utils";
import { cleanInlineLabel, type TopicKind } from "@/lib/summary-utils";

type TopicCardTopic = {
  id: string;
  rank: number;
  title: string;
  content: string;
};

function topicKindMeta(kind: TopicKind): {
  label: string;
  tagVariant: "success" | "warning" | "error" | "neutral";
  cardClassName: string;
  bodyClassName: string;
  accentClassName: string;
} {
  if (kind === "dor") {
    return {
      label: "Dor",
      tagVariant: "error",
      cardClassName: "border-destructive/20 bg-card",
      bodyClassName: "bg-destructive/5 border-destructive/15",
      accentClassName: "border-l-destructive/40",
    };
  }

  if (kind === "desejo") {
    return {
      label: "Oportunidade",
      tagVariant: "success",
      cardClassName: "border-success/20 bg-card",
      bodyClassName: "bg-success/5 border-success/15",
      accentClassName: "border-l-success/40",
    };
  }

  return {
    label: "Tema",
    tagVariant: "neutral",
    cardClassName: "border-border/80 bg-card",
    bodyClassName: "bg-muted/20 border-border/60",
    accentClassName: "border-l-muted-foreground/20",
  };
}

export function TopicCard({
  topic,
  kind,
  emphasis,
}: {
  topic: TopicCardTopic;
  kind: TopicKind;
  emphasis?: "top" | "default";
}) {
  const meta = topicKindMeta(kind);
  const title = cleanInlineLabel(topic.title || "") || "Assunto";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        "transition-colors duration-200",
        meta.cardClassName,
        meta.accentClassName,
        "border-l-[3px]",
        emphasis === "top" && "shadow-sm ring-1 ring-border/40",
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusTag variant={meta.tagVariant}>{meta.label}</StatusTag>
            <Badge
              variant="secondary"
              className={cn(
                "h-5 px-2 text-[11px] font-medium text-muted-foreground bg-muted/40 hover:bg-muted/40",
                emphasis === "top" && "text-foreground/80",
              )}
            >
              Top {topic.rank}
            </Badge>
          </div>
          {emphasis === "top" ? (
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Maior prioridade
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "font-semibold text-foreground leading-snug max-w-[92ch]",
            emphasis === "top" ? "text-base sm:text-[15px]" : "text-sm sm:text-[15px]",
          )}
        >
          {title}
        </div>

        <div className={cn("rounded-xl border px-3 py-3", meta.bodyClassName)}>
          <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words max-w-[92ch]">
            {topic.content || "Sem detalhes adicionais para este assunto."}
          </div>
        </div>
      </div>
    </div>
  );
}
