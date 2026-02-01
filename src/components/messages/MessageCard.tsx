import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, FileText, Image, MapPin, Mic, MessageSquare, Shield, Smile, Video } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { formatWhatsAppRichText, formatWhatsAppStyles } from "@/lib/whatsapp-format";
import { formatDateTimeBR } from "@/lib/date";
import { cn, getInitialsFromName } from "@/lib/utils";
import { extractLinkDomains, translateMessageType } from "@/lib/messages";
import { ReactionBadges } from "@/components/messages/ReactionBadges";
import type { MessageFeed, ReactionSummary } from "@/hooks/use-group-messages";

type MessageCardProps = {
  message: MessageFeed;
  groupId: string;
  onOpenDetails: (message: MessageFeed) => void;
  reactions?: ReactionSummary[];
};

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
        <div className="flex items-center gap-2">
          {message.media_url ? (
            <img
              src={message.media_url}
              alt="preview"
              className="w-10 h-10 rounded object-cover bg-muted"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
              <Image className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <span className="text-muted-foreground text-sm">[Imagem]</span>
        </div>
      );
    case "audio":
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
            <Mic className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-muted-foreground text-sm">[Áudio]</span>
        </div>
      );
    case "video":
      return (
        <div className="flex items-center gap-2">
          {message.thumbnail_url ? (
            <img
              src={message.thumbnail_url}
              alt="thumbnail"
              className="w-10 h-10 rounded object-cover bg-muted"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
              <Video className="h-5 w-5 text-primary" />
            </div>
          )}
          <span className="text-muted-foreground text-sm">[Vídeo]</span>
        </div>
      );
    case "document":
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-accent/20 flex items-center justify-center">
            <FileText className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="text-muted-foreground text-sm">[Documento]</span>
        </div>
      );
    case "location":
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-success/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-success" />
          </div>
          <span className="text-muted-foreground text-sm">[Localização]</span>
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
  const isSystem = !message.member_id || message.message_type === "system";

  const handleOpen = () => onOpenDetails(message);

  return (
    <article
      className={cn(
        "group rounded-2xl border border-border/60 bg-card/70 px-4 py-4 sm:px-5 cursor-pointer transition-[box-shadow,transform] duration-150 hover:shadow-md hover:scale-[1.01]",
        isSystem && "border-dashed",
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {message.member_id ? (
              <div
                className="min-w-0"
                onClickCapture={(e) => e.stopPropagation()}
                onKeyDownCapture={(e) => {
                  if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                }}
              >
                <MemberInlineTrigger memberId={message.member_id} groupId={groupId} name={message.member_name} avatarUrl={message.member_avatar} size="md" />
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9 ring-1 ring-border/60">
                  <AvatarFallback className="text-[11px] bg-muted/40">{getInitialsFromName("Sistema") || <Shield className="h-4 w-4" />}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground">Sistema</span>
              </div>
            )}

            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <TypeIcon className="h-3.5 w-3.5" />
              {translateMessageType(message.message_type)}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{formatDateTimeBR(message.created_at)}</span>
            <span className="sm:hidden inline-flex items-center gap-1.5">
              <TypeIcon className="h-3.5 w-3.5" />
              {translateMessageType(message.message_type)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-background/70 border border-border/50 px-3.5 py-3">
        {message.message_type === "text" ? (
          <div>
            {isExpanded ? (
              <div className="text-sm text-foreground/90">{formatWhatsAppRichText(text)}</div>
            ) : (
              <p className="text-sm text-foreground/90 leading-relaxed line-clamp-2 break-words">{formatWhatsAppStyles(text || "")}</p>
            )}

            {domains.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {domains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] text-secondary-foreground">
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
                className="mt-2 text-xs font-medium text-primary hover:underline underline-offset-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded((prev) => !prev);
                }}
              >
                {isExpanded ? "Recolher" : "Ler mensagem completa"}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <MessageContentPreview message={message} />
          </div>
        )}

        <div className="mt-2">
          <ReactionBadges reactions={(reactions || []).map((r) => ({ emoji: r.emoji, count: r.count }))} />
        </div>
      </div>
    </article>
  );
}

