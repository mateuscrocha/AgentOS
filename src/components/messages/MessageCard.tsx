import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, FileText, Image, MapPin, Mic, MessageSquare, Shield, Smile, Video } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { formatWhatsAppRichText, formatWhatsAppStyles } from "@/lib/whatsapp-format";
import { formatDateTimeBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { extractLinkDomains, translateMessageType } from "@/lib/messages";
import { ReactionBadges } from "@/components/messages/ReactionBadges";
import type { MessageFeed, ReactionSummary } from "@/hooks/use-group-messages";

type MessageCardProps = {
  message: MessageFeed;
  groupId: string;
  onOpenDetails: (message: MessageFeed) => void;
  reactions?: ReactionSummary[];
};

const SENDER_NAME_TONES = [
  "text-sky-700 dark:text-sky-300",
  "text-violet-700 dark:text-violet-300",
  "text-amber-700 dark:text-amber-300",
  "text-cyan-700 dark:text-cyan-300",
  "text-rose-700 dark:text-rose-300",
  "text-indigo-700 dark:text-indigo-300",
  "text-teal-700 dark:text-teal-300",
];

const getSenderTone = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return SENDER_NAME_TONES[hash % SENDER_NAME_TONES.length];
};

const formatBubbleTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const getMessageTypeIcon = (type: string) => {
  switch (type) {
    case "image":
      return Image;
    case "audio":
      return Mic;
    case "video":
      return Video;
    case "document":
      return FileText;
    case "sticker":
      return Smile;
    case "location":
      return MapPin;
    case "poll":
      return Activity;
    case "poll_vote":
      return Activity;
    default:
      return MessageSquare;
  }
};

function PollInlineSummary({ groupId, providerMessageId }: { groupId: string; providerMessageId: string | null }) {
  const { data: poll } = useQuery({
    queryKey: ["poll-inline", groupId, providerMessageId],
    queryFn: async () => {
      if (!providerMessageId) return null;
      const { data } = await (supabase as any)
        .from("polls")
        .select("id")
        .eq("group_id", groupId)
        .eq("whatsapp_provider_id", providerMessageId)
        .maybeSingle();
      return data;
    },
    enabled: !!groupId && !!providerMessageId,
  });

  const { data: summary } = useQuery({
    queryKey: ["poll-inline-summary", poll?.id],
    queryFn: async () => {
      if (!poll?.id) return null;
      const { data } = await (supabase as any)
        .from("v_poll_summary")
        .select("voters_count, vote_events_count")
        .eq("poll_id", poll.id)
        .maybeSingle();
      return data;
    },
    enabled: !!poll?.id,
  });

  const { data: results } = useQuery({
    queryKey: ["poll-inline-results", poll?.id],
    queryFn: async () => {
      if (!poll?.id) return [];
      const { data } = await (supabase as any)
        .from("v_poll_results")
        .select("option_text, option_index, votes_count")
        .eq("poll_id", poll.id)
        .order("option_index", { ascending: true });
      return (data ?? []).slice(0, 3).map((r: { option_text: string; option_index: number; votes_count: number | null }) => ({
        optionText: r.option_text as string,
        optionIndex: Number(r.option_index),
        votesCount: Number(r.votes_count ?? 0),
      }));
    },
    enabled: !!poll?.id,
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground">{summary?.vote_events_count ? `${summary.vote_events_count} voto(s)` : "Sem votos"}</span>
      {(results ?? []).map((r: { optionText: string; optionIndex: number; votesCount: number }) => (
        <span key={r.optionIndex} className="text-[11px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
          {r.optionText} {r.votesCount}
        </span>
      ))}
    </div>
  );
}

function MessageContentPreview({ message }: { message: MessageFeed }) {
  switch (message.message_type) {
    case "image":
      return (
        <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/60 p-2">
          {message.media_url ? (
            <img
              src={message.media_url}
              alt="preview"
              className="w-14 h-14 rounded-lg object-cover bg-muted"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
              <Image className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Foto</div>
            <div className="text-xs text-muted-foreground truncate">{message.content_preview || "Imagem enviada"}</div>
          </div>
        </div>
      );
    case "audio":
      return (
        <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/60 p-2">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Mic className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Áudio</div>
            <div className="text-xs text-muted-foreground">Mensagem de voz</div>
          </div>
        </div>
      );
    case "video":
      return (
        <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/60 p-2">
          {message.thumbnail_url ? (
            <img
              src={message.thumbnail_url}
              alt="thumbnail"
              className="w-14 h-14 rounded-lg object-cover bg-muted"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
              <Video className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Vídeo</div>
            <div className="text-xs text-muted-foreground truncate">{message.content_preview || "Vídeo enviado"}</div>
          </div>
        </div>
      );
    case "document":
      return (
        <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/60 p-2">
          <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
            <FileText className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Documento</div>
            <div className="text-xs text-muted-foreground truncate">{message.content_preview || "Arquivo enviado"}</div>
          </div>
        </div>
      );
    case "location":
      return (
        <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/60 p-2">
          <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-success" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Localização</div>
            <div className="text-xs text-muted-foreground">Compartilhada no grupo</div>
          </div>
        </div>
      );
    case "poll":
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm line-clamp-1">{message.content_preview || "[Enquete]"}</span>
          </div>
          <PollInlineSummary groupId={message.group_id} providerMessageId={message.whatsapp_provider_id || null} />
        </div>
      );
    case "poll_vote":
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-secondary/50 flex items-center justify-center">
            <Activity className="h-5 w-5 text-secondary-foreground" />
          </div>
          <span className="text-muted-foreground text-sm">{message.content_preview || "[Voto]"}</span>
        </div>
      );
    default:
      return (
        <span className="text-sm line-clamp-2">
          {message.message_type === "system"
            ? formatWhatsAppStyles(message.content_preview || `[${translateMessageType(message.message_type)}]`)
            : message.content_preview || `[${translateMessageType(message.message_type)}]`}
        </span>
      );
  }
}

export function MessageCard({ message, groupId, onOpenDetails, reactions }: MessageCardProps) {
  const TypeIcon = useMemo(() => getMessageTypeIcon(message.message_type), [message.message_type]);
  const [isExpanded, setIsExpanded] = useState(false);

  const text = (message.content_preview || "").toString();
  const canExpand = message.message_type === "text" && (text.length >= 160 || /\n/.test(text));
  const domains = message.message_type === "text" ? extractLinkDomains(text) : [];
  const isSystem = message.message_type === "system";
  const isUnknownSender = !message.member_id && !isSystem;
  const senderTone = getSenderTone(message.member_id || message.member_name || "member");
  const bubbleTone = isSystem
    ? "bg-muted/60 border-border/60"
    : message.message_type === "text"
      ? "bg-emerald-50/90 border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800/60"
      : "bg-card/95 border-border/70";

  const handleOpen = () => onOpenDetails(message);

  if (isSystem) {
    return (
      <article
        className="flex justify-center"
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
      >
        <div className="group max-w-[90%] rounded-2xl border border-dashed border-border/70 bg-muted/40 px-4 py-3 text-center cursor-pointer transition-colors hover:bg-muted/60">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">Sistema</span>
            <span>•</span>
            <TypeIcon className="h-3.5 w-3.5" />
            <span>{translateMessageType(message.message_type)}</span>
            <span>•</span>
            <span className="tabular-nums">{formatDateTimeBR(message.created_at)}</span>
          </div>
          <div className="mt-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-left">
            {message.message_type === "text" ? (
              <p className="text-sm text-foreground/90 leading-relaxed break-words">{formatWhatsAppStyles(text || "")}</p>
            ) : (
              <MessageContentPreview message={message} />
            )}
            <div className="mt-2">
              <ReactionBadges reactions={(reactions || []).map((r) => ({ emoji: r.emoji, count: r.count }))} />
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group flex items-start gap-2.5 sm:gap-3 cursor-pointer",
      )}
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
    >
      <div
        className="shrink-0"
        onClickCapture={(e) => e.stopPropagation()}
        onKeyDownCapture={(e) => {
          if (e.key === "Enter" || e.key === " ") e.stopPropagation();
        }}
      >
        {isUnknownSender ? (
          <div className="flex items-center justify-center">
            <Avatar className="h-9 w-9 ring-1 ring-border/60">
              <AvatarFallback className="text-[11px] bg-muted/50 text-muted-foreground">?</AvatarFallback>
            </Avatar>
          </div>
        ) : (
          <MemberInlineTrigger memberId={message.member_id as string} groupId={groupId} name={message.member_name} avatarUrl={message.member_avatar} size="md" />
        )}
      </div>

      <div className="relative min-w-0 max-w-[min(100%,42rem)]">
        <div
          className={cn(
            "relative rounded-2xl rounded-tl-md border px-3.5 py-2.5 shadow-sm transition-[transform,box-shadow] duration-150 group-hover:shadow-md group-hover:translate-y-[-1px]",
            bubbleTone,
          )}
        >
          <div className={cn("absolute -left-[5px] top-3 h-3 w-3 rotate-45 rounded-[2px] border-l border-b", bubbleTone)} aria-hidden />
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className={cn("text-[13px] font-semibold leading-tight truncate", isUnknownSender ? "text-muted-foreground" : senderTone)}>
                {isUnknownSender ? "Remetente não identificado" : (message.member_name || "Membro")}
              </div>
              <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <TypeIcon className="h-3 w-3" />
                <span>{translateMessageType(message.message_type)}</span>
              </div>
            </div>
            <span className="hidden sm:inline shrink-0 text-[11px] text-muted-foreground/80 tabular-nums pl-2" title={formatDateTimeBR(message.created_at)}>
              {formatBubbleTime(message.created_at)}
            </span>
          </div>

        {message.message_type === "text" ? (
          <div>
            {isExpanded ? (
              <div className="text-sm text-foreground/90 leading-relaxed break-words">{formatWhatsAppRichText(text)}</div>
            ) : (
              <p className="text-sm text-foreground/90 leading-relaxed line-clamp-2 break-words">{formatWhatsAppStyles(text || "")}</p>
            )}

            {domains.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {domains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[11px] text-foreground/80">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=32`}
                      alt=""
                      className="h-3 w-3 rounded-sm"
                      referrerPolicy="no-referrer"
                    />
                    {d}
                  </span>
                ))}
              </div>
            ) : null}

            {canExpand ? (
              <button
                type="button"
                className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline underline-offset-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded((prev) => !prev);
                }}
              >
                {isExpanded ? "Recolher prévia" : "Expandir prévia"}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <MessageContentPreview message={message} />
          </div>
        )}

        <div className="mt-2 flex items-end justify-between gap-2">
          <ReactionBadges reactions={(reactions || []).map((r) => ({ emoji: r.emoji, count: r.count }))} className="mt-0" />
          <span className="text-[10px] text-muted-foreground/70 tabular-nums sm:hidden" title={formatDateTimeBR(message.created_at)}>
            {formatBubbleTime(message.created_at)}
          </span>
        </div>
      </div>
      </div>
    </article>
  );
}
