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
  accentClassName: string;
} {
  if (kind === "dor") {
    return {
      label: "Dor",
      tagVariant: "error",
      cardClassName: "border-destructive/20 bg-destructive/5",
      accentClassName: "border-l-destructive/35",
    };
  }

  if (kind === "desejo") {
    return {
      label: "Oportunidade",
      tagVariant: "success",
      cardClassName: "border-success/20 bg-success/5",
      accentClassName: "border-l-success/35",
    };
  }

  return {
    label: "Tema",
    tagVariant: "neutral",
    cardClassName: "border-border bg-card",
    accentClassName: "border-l-muted-foreground/15",
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
        "border-l-2",
        emphasis === "top" && "shadow-sm",
      )}
    >
      <div className="space-y-3">
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

        <div
          className={cn(
            "font-semibold text-foreground leading-snug max-w-[92ch]",
            emphasis === "top" ? "text-base sm:text-[15px]" : "text-sm",
          )}
        >
          {title}
        </div>

        <div className="rounded-lg bg-muted/30 px-3 py-2.5">
          <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words max-w-[92ch]">
            {topic.content || "Sem detalhes adicionais para este assunto."}
          </div>
        </div>
      </div>
    </div>
  );
}

