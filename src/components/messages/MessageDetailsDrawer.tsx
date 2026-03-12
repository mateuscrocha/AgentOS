import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { formatDateTimeBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  buildMentionMapFromRows,
  buildMentionPlusPhones,
  buildMentionProviderCandidates,
} from "@/lib/message-mentions";
import { applyWhatsAppStylesToParts, formatWhatsAppStyles } from "@/lib/whatsapp-format";
import { translateMessageType } from "@/lib/messages";
import { Link as LinkIcon, Image, Mic, Video, FileText, MessageSquare, ArrowDownLeft, ArrowUpRight, Smile } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

type Variant = "sheet" | "dialog";

type MessageDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  groupId: string;
  variant?: Variant;
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "image": return Image;
    case "audio": return Mic;
    case "video": return Video;
    case "document": return FileText;
    default: return MessageSquare;
  }
};

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const linkOrMentionRegex = /(https?:\/\/[^\s]+)|@([0-9]{5,})/g;
const renderTextWithMentionsAndLinks = (text: string, mentionMap: Record<string, string>) => {
  const result: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(linkOrMentionRegex)) {
    const idx = match.index || 0;
    if (idx > lastIndex) result.push(text.slice(lastIndex, idx));
    const url = match[1];
    const mentionId = match[2];
    if (url) {
      result.push(
        <a
          key={`u-${idx}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        >
          {url}
        </a>
      );
    } else if (mentionId) {
      const name = mentionMap[mentionId];
      result.push(
        <span key={`m-${idx}`} className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
          @{name || mentionId}
        </span>
      );
    }
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return applyWhatsAppStylesToParts(result);
};

function MediaPreviewPanel({
  src,
  alt,
  title,
  kind = "image",
  icon: Icon,
  posterSrc,
}: {
  src?: string | null;
  alt: string;
  title: string;
  kind?: "image" | "sticker" | "video";
  icon: typeof Image;
  posterSrc?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const hasMedia = !!src && !failed;

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-2">
      {hasMedia ? (
        <a
          href={src || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border border-border/50",
              kind === "sticker" && "bg-[radial-gradient(circle_at_1px_1px,rgba(120,120,120,0.15)_1px,transparent_0)] bg-[size:14px_14px]",
            )}
          >
            <img
              src={(kind === "video" ? posterSrc : src) || src || ""}
              alt={alt}
              className={cn(
                "mx-auto w-full",
                kind === "sticker"
                  ? "max-h-[260px] object-contain bg-transparent"
                  : kind === "video"
                    ? "max-h-[420px] object-cover bg-black"
                    : "max-h-[420px] object-contain bg-muted",
              )}
              onError={() => setFailed(true)}
            />
            {kind === "video" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
                  <Video className="h-6 w-6 text-white" />
                </div>
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-white">
                <Icon className="h-3 w-3" />
                <span>{title}</span>
              </div>
            </div>
          </div>
        </a>
      ) : (
        <div className="rounded-lg border border-border bg-background/50 p-6 text-center text-sm text-muted-foreground">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          Prévia indisponível
        </div>
      )}
    </div>
  );
}

function MediaActionButtons({ url, label = "Abrir original" }: { url?: string | null; label?: string }) {
  if (!url) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={url} target="_blank" rel="noopener noreferrer"> {label} </a>
      </Button>
      <Button asChild variant="secondary" size="sm">
        <a href={url} download>Baixar</a>
      </Button>
    </div>
  );
}

export function MessageDetailsDrawer({ open, onOpenChange, groupId, messageId, variant = "sheet" }: MessageDetailsDrawerProps) {
  const sectionClassName = "rounded-xl border border-border bg-card/50 p-4 sm:p-5 space-y-3";
  const navigate = useNavigate();
  const location = useLocation();

  const formatDateFriendly = (input?: string | Date): string => {
    if (!input) return "—";
    try {
      const s = formatDateTimeBR(input);
      return s.replace(",", "").replace(" ", " às ");
    } catch {
      return "—";
    }
  };

  const { data: message, isLoading: messageLoading, error: messageError } = useQuery({
    queryKey: ["message-details", groupId, messageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("group_id", groupId)
        .eq("id", messageId)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!groupId && !!messageId,
  });

  const { data: group } = useQuery({
    queryKey: ["message-details-group", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("id,name")
        .eq("id", groupId)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!groupId,
  });

  const { data: author } = useQuery({
    queryKey: ["message-details-author", groupId, message?.member_id],
    queryFn: async () => {
      if (!message?.member_id) return null;
      const { data } = await supabase
        .from("members")
        .select("id,name,display_name,profile_pic_url,is_admin,is_super_admin,last_seen_message_at")
        .eq("group_id", groupId)
        .eq("id", message.member_id)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!groupId && !!message?.member_id,
  });

  const mentionIds = useMemo(() => {
    const src = (message?.text || message?.content || "").toString();
    const ids = Array.from(src.matchAll(/@([0-9]{5,})/g)).map(m => m[1]);
    return Array.from(new Set(ids));
  }, [message]);

  const { data: mentionMap } = useQuery({
    queryKey: ["message-details-mentions", groupId, mentionIds.join(",")],
    queryFn: async () => {
      if (!mentionIds.length) return {} as Record<string, string>;
      const plusPhones = buildMentionPlusPhones(mentionIds);
      const providerCandidates = buildMentionProviderCandidates(mentionIds);
      const [{ data: byProvider }, { data: byPhone }, { data: byLid }] = await Promise.all([
        supabase
          .from("members")
          .select("whatsapp_provider_id,name,display_name,phone_e164,lid")
          .eq("group_id", groupId)
          .in("whatsapp_provider_id", providerCandidates),
        supabase
          .from("members")
          .select("phone_e164,name,display_name,lid")
          .eq("group_id", groupId)
          .in("phone_e164", plusPhones),
        supabase
          .from("members")
          .select("lid,name,display_name,phone_e164")
          .eq("group_id", groupId)
          .in("lid", mentionIds),
      ]);
      return buildMentionMapFromRows(byProvider as any, byPhone as any, byLid as any);
    },
    enabled: open && !!groupId && mentionIds.length > 0,
  });

  const { data: contextBefore } = useQuery({
    queryKey: ["message-details-context-before", groupId, message?.created_at],
    queryFn: async () => {
      if (!message?.created_at) return [] as any[];
      const { data } = await supabase
        .from("v_messages_feed")
        .select("message_id,member_name,content_preview,message_type,created_at")
        .eq("group_id", groupId)
        .lt("created_at", message.created_at)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as any[];
    },
    enabled: open && !!groupId && !!message?.created_at,
  });

  const { data: contextAfter } = useQuery({
    queryKey: ["message-details-context-after", groupId, message?.created_at],
    queryFn: async () => {
      if (!message?.created_at) return [] as any[];
      const { data } = await supabase
        .from("v_messages_feed")
        .select("message_id,member_name,content_preview,message_type,created_at")
        .eq("group_id", groupId)
        .gt("created_at", message.created_at)
        .order("created_at", { ascending: true })
        .limit(5);
      return (data ?? []) as any[];
    },
    enabled: open && !!groupId && !!message?.created_at,
  });

  const { data: memberMessageCount } = useQuery({
    queryKey: ["message-details-member-count", groupId, message?.member_id],
    queryFn: async () => {
      if (!message?.member_id) return 0;
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("member_id", message.member_id);
      return count || 0;
    },
    enabled: open && !!groupId && !!message?.member_id,
  });

  const roleLabel = useMemo(() => {
    if (!message) return "";
    if (!message.member_id) return message.message_type === "system" ? "Sistema" : "Remetente não identificado";
    const isAdmin = author?.is_admin || author?.is_super_admin;
    return isAdmin ? "Administrador do grupo" : "Membro";
  }, [message, author]);

  const originLabel = useMemo(() => {
    const p = (message as any)?.provider;
    const src = (message as any)?.metadata?.source;
    if (p === "manual_import" || src === "manual_import") return "Importação manual";
    return "Conversa em tempo real";
  }, [message]);

  const directionLabel = useMemo(() => {
    const dir = (message?.direction || "").toString();
    if (!dir) return message?.from_me ? "Saída" : "Entrada";
    if (dir === "outbound") return "Saída";
    if (dir === "inbound") return "Entrada";
    return dir;
  }, [message]);

  const DirectionIcon = useMemo(() => {
    const dir = (message?.direction || "").toString();
    if (dir === "outbound" || message?.from_me) return ArrowUpRight;
    return ArrowDownLeft;
  }, [message]);

  const classificationLabel = useMemo(() => {
    const txt = ((message?.text || message?.content || "") as string).toLowerCase();
    if (!txt.trim()) return "Texto";
    if (txt.includes("http://") || txt.includes("https://")) return "Link";
    if (txt.length > 3000) return "Texto longo";
    return "Texto";
  }, [message]);

  const messageTypeLabel = useMemo(() => {
    const mt = (message?.message_type || "text").toString();
    return mt === "text" ? classificationLabel : translateMessageType(mt);
  }, [message, classificationLabel]);

  const TypeIcon = useMemo(() => getTypeIcon((message?.message_type || "text").toString()), [message]);

  const contextRows = useMemo(() => {
    const before = [...(contextBefore || [])].reverse();
    const after = [...(contextAfter || [])];
    return { before, after };
  }, [contextBefore, contextAfter]);

  const openContextMessage = (targetMessageId: string) => {
    const targetPath = `/groups/${groupId}/messages`;
    if (location.pathname === targetPath) {
      const sp = new URLSearchParams(location.search);
      sp.set("messageId", targetMessageId);
      navigate({ pathname: targetPath, search: `?${sp.toString()}` }, { replace: true });
      return;
    }
    navigate(`${targetPath}?messageId=${encodeURIComponent(targetMessageId)}`);
  };

  const headerSection = (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <TypeIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-card-foreground pr-10">Detalhes da mensagem</h3>
            {!messageLoading && !messageError && message ? (
              <>
                <span className={cn(badgeVariants({ variant: "outline" }), "text-[10px] bg-secondary/20")}>{messageTypeLabel}</span>
                <span className={cn(badgeVariants({ variant: "outline" }), "text-[10px] bg-secondary/20 inline-flex items-center gap-1")}>{<DirectionIcon className="h-3 w-3" />}{directionLabel}</span>
                <span className={cn(badgeVariants({ variant: "outline" }), "text-[10px] bg-secondary/20")}>{originLabel}</span>
              </>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {messageLoading ? (
              <Skeleton className="h-4 w-56" />
            ) : messageError ? (
              <span className="text-destructive">Não foi possível carregar os detalhes desta mensagem.</span>
            ) : (
              <>
                <span>{formatDateFriendly(message?.created_at)}</span>
                <span className="mx-1 text-muted-foreground/60">•</span>
                <a href={`/groups/${groupId}`} className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">{group?.name || "Grupo"}</a>
              </>
            )}
          </div>
        </div>
      </div>
      {!messageLoading && !messageError && message ? (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <div className="flex items-center gap-2">
            {message?.member_id ? (
              <MemberInlineTrigger memberId={message.member_id} groupId={groupId} name={author?.display_name || author?.name || message.sender_name || "Membro"} avatarUrl={(author as any)?.profile_pic_url || null} variant={variant} />
            ) : (
              <span className="text-muted-foreground">{message?.message_type === "system" ? "Sistema" : "Remetente não identificado"}</span>
            )}
            {roleLabel ? (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{roleLabel}</Badge>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  const contentSection = (
    <section className={sectionClassName}>
      <h4 className="text-sm font-semibold text-card-foreground">Conteúdo</h4>
      {messageLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !message ? (
        <div className="text-sm text-muted-foreground">Sem conteúdo</div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-50/40 via-background to-teal-50/30 dark:from-emerald-950/10 dark:via-background dark:to-teal-950/10 p-3">
          <div
            className="rounded-xl border border-white/40 dark:border-white/5 p-2"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(120,120,120,0.09) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <TypeIcon className="h-4 w-4" />
              </div>
              <div className="relative min-w-0 w-full max-w-[42rem]">
                <div className={cn(
                  "relative rounded-2xl rounded-tl-md border px-3 py-2.5 shadow-sm",
                  message.message_type === "system"
                    ? "bg-muted/50 border-border/60"
                    : "bg-emerald-50/90 border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-900/50",
                )}>
                  <div className={cn(
                    "absolute -left-[5px] top-3 h-3 w-3 rotate-45 rounded-[2px] border-l border-b",
                    message.message_type === "system"
                      ? "bg-muted/50 border-border/60"
                      : "bg-emerald-50/90 border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-900/50",
                  )} />

                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-foreground truncate">
                        {message.member_id
                          ? (author?.display_name || author?.name || message.sender_name || "Membro")
                          : (message.message_type === "system" ? "Sistema" : "Remetente não identificado")}
                      </div>
                      <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <TypeIcon className="h-3 w-3" />
                        <span>{messageTypeLabel}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="space-y-3">
          {(message.message_type === "text" || message.message_type === "system") && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-card-foreground whitespace-pre-wrap break-words">
              {message.text
                ? renderTextWithMentionsAndLinks(message.text, mentionMap || {})
                : renderTextWithMentionsAndLinks(message.content || "[Texto]", mentionMap || {})}
            </div>
          )}

          {message.message_type === "image" && (
            <div className="space-y-3">
              <MediaPreviewPanel src={message.media_url} alt="Imagem" title="Foto" kind="image" icon={Image} />
              <MediaActionButtons url={message.media_url} label="Abrir imagem" />
              {message.media_caption ? (
                <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Legenda</div>
                  <div className="text-sm text-card-foreground whitespace-pre-wrap break-words">{message.media_caption}</div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {message.media_mime_type ? <span className={cn(badgeVariants({ variant: "secondary" }), "rounded-lg px-2.5 py-1 text-[11px]")}>{message.media_mime_type}</span> : null}
                {message.media_size_bytes ? <span className={cn(badgeVariants({ variant: "secondary" }), "rounded-lg px-2.5 py-1 text-[11px]")}>{formatFileSize(message.media_size_bytes)}</span> : null}
              </div>
            </div>
          )}

          {message.message_type === "sticker" && (
            <div className="space-y-3">
              <MediaPreviewPanel src={message.media_url || message.thumbnail_url} alt="Figurinha" title="Figurinha" kind="sticker" icon={Smile} />
              <MediaActionButtons url={message.media_url || message.thumbnail_url} label="Abrir figurinha" />
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {message.media_mime_type ? <span className={cn(badgeVariants({ variant: "secondary" }), "rounded-lg px-2.5 py-1 text-[11px]")}>{message.media_mime_type}</span> : null}
                {message.media_size_bytes ? <span className={cn(badgeVariants({ variant: "secondary" }), "rounded-lg px-2.5 py-1 text-[11px]")}>{formatFileSize(message.media_size_bytes)}</span> : null}
              </div>
            </div>
          )}

          {message.message_type === "audio" && (
            <div className="space-y-2">
              {message.media_url ? (
                <audio controls className="w-full" src={message.media_url} />
              ) : (
                <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">Mídia indisponível</div>
              )}
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                {message.media_duration_sec ? <span className={cn(badgeVariants({ variant: "secondary" }), "rounded-lg px-2.5 py-1 text-[11px]")}>Duração: {formatDuration(message.media_duration_sec)}</span> : null}
                {message.media_size_bytes ? <span className={cn(badgeVariants({ variant: "secondary" }), "rounded-lg px-2.5 py-1 text-[11px]")}>{formatFileSize(message.media_size_bytes)}</span> : null}
                {(message.text || message.content) ? <span className={cn(badgeVariants({ variant: "outline" }), "rounded-lg px-2.5 py-1 text-[11px] bg-secondary/10")}>Transcrição disponível</span> : null}
              </div>
              {(message.text || message.content) ? (
                <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-card-foreground whitespace-pre-wrap break-words">
                  {message.text
                    ? renderTextWithMentionsAndLinks(message.text, mentionMap || {})
                    : renderTextWithMentionsAndLinks(message.content || "[Texto]", mentionMap || {})}
                </div>
              ) : null}
            </div>
          )}

          {message.message_type === "video" && (
            <div className="space-y-3">
              {(message.thumbnail_url || message.media_url) ? (
                <MediaPreviewPanel
                  src={message.media_url}
                  posterSrc={message.thumbnail_url}
                  alt="Vídeo"
                  title="Vídeo"
                  kind="video"
                  icon={Video}
                />
              ) : (
                <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">Mídia indisponível</div>
              )}
              <MediaActionButtons url={message.media_url} label="Abrir vídeo" />
              {message.media_url ? (
                <video controls className="w-full max-h-[420px] rounded-xl bg-black" poster={message.thumbnail_url || undefined} src={message.media_url} />
              ) : null}
              {message.media_caption ? (
                <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Legenda</div>
                  <div className="text-sm text-card-foreground whitespace-pre-wrap break-words">{message.media_caption}</div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {message.media_mime_type ? <span className={cn(badgeVariants({ variant: "secondary" }), "rounded-lg px-2.5 py-1 text-[11px]")}>{message.media_mime_type}</span> : null}
                {message.media_size_bytes ? <span className={cn(badgeVariants({ variant: "secondary" }), "rounded-lg px-2.5 py-1 text-[11px]")}>{formatFileSize(message.media_size_bytes)}</span> : null}
                {message.media_duration_sec ? <span className={cn(badgeVariants({ variant: "secondary" }), "rounded-lg px-2.5 py-1 text-[11px]")}>Duração: {formatDuration(message.media_duration_sec)}</span> : null}
              </div>
            </div>
          )}

          {message.message_type === "document" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-secondary/30">
                <div className="mt-0.5 text-primary"><FileText className="h-6 w-6" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-card-foreground truncate">{message.media_caption || "Documento"}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {message.media_mime_type ? <span>{message.media_mime_type}</span> : null}
                    {message.media_size_bytes ? <span>{formatFileSize(message.media_size_bytes)}</span> : null}
                  </div>
                </div>
                {message.media_url ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={message.media_url} target="_blank" rel="noopener noreferrer">Abrir</a>
                  </Button>
                ) : null}
              </div>
              <MediaActionButtons url={message.media_url} label="Abrir documento" />
            </div>
          )}

          {message.message_type && !["text", "system", "image", "audio", "video", "document", "sticker"].includes(message.message_type) ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground inline-flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
                Conteúdo do tipo {translateMessageType(message.message_type)}
            </div>
          ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );

  const contextSection = (
    <section className={sectionClassName}>
      <h4 className="text-sm font-semibold text-card-foreground">Contexto na conversa</h4>
      {messageLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <div className="space-y-2">
          {[...(contextBefore || []), ...(contextAfter || [])].length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem mensagens próximas.</p>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-50/30 via-background to-teal-50/20 dark:from-emerald-950/10 dark:via-background dark:to-teal-950/10 p-3">
              <div
                className="rounded-xl border border-white/40 dark:border-white/5 p-2 space-y-2"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(120,120,120,0.09) 1px, transparent 0)",
                  backgroundSize: "18px 18px",
                }}
              >
              {contextRows.before.map((c) => (
                <button
                  key={`before-${c.message_id}`}
                  type="button"
                  onClick={() => openContextMessage(c.message_id)}
                  className="w-full text-left rounded-xl border border-border/60 bg-background/85 px-3 py-2 hover:bg-background transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{formatDateFriendly(c.created_at)}</span>
                    <span className="text-muted-foreground/60">•</span>
                    <span className="truncate">{c.member_name || "Desconhecido"}</span>
                  </div>
                  <div className="mt-1 text-sm text-card-foreground line-clamp-2 whitespace-pre-wrap break-words">
                    {c.message_type === "system"
                      ? formatWhatsAppStyles(c.content_preview || `[${translateMessageType(c.message_type)}]`)
                      : (c.content_preview || `[${translateMessageType(c.message_type)}]`)}
                  </div>
                </button>
              ))}

              <div className="flex justify-end">
                <div className="max-w-[92%] rounded-2xl rounded-tr-md border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/90 dark:bg-emerald-950/25 px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">Mensagem selecionada</span>
                    <span className="text-muted-foreground/60">•</span>
                    <span>{formatDateFriendly(message?.created_at)}</span>
                  </div>
                  <div className="mt-1 text-sm text-card-foreground whitespace-pre-wrap break-words">
                    {(() => {
                      const raw = (message?.text || message?.content || message?.media_caption || "").toString().trim() || `[${translateMessageType(message?.message_type || "text")}]`;
                      return message?.message_type === "system" ? formatWhatsAppStyles(raw) : raw;
                    })()}
                  </div>
                </div>
              </div>

              {contextRows.after.map((c) => (
                <button
                  key={`after-${c.message_id}`}
                  type="button"
                  onClick={() => openContextMessage(c.message_id)}
                  className="w-full text-left rounded-xl border border-border/60 bg-background/85 px-3 py-2 hover:bg-background transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{formatDateFriendly(c.created_at)}</span>
                    <span className="text-muted-foreground/60">•</span>
                    <span className="truncate">{c.member_name || "Desconhecido"}</span>
                  </div>
                  <div className="mt-1 text-sm text-card-foreground line-clamp-2 whitespace-pre-wrap break-words">
                    {c.message_type === "system"
                      ? formatWhatsAppStyles(c.content_preview || `[${translateMessageType(c.message_type)}]`)
                      : (c.content_preview || `[${translateMessageType(c.message_type)}]`)}
                  </div>
                </button>
              ))}

              <div className="flex justify-end">
                <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                  <a href={`/groups/${groupId}/messages?messageId=${encodeURIComponent(messageId)}`}>Ver na conversa completa</a>
                </Button>
              </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );

  const quickInfoSection = (
    <section className={sectionClassName}>
      <h4 className="text-sm font-semibold text-card-foreground">Visão geral</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-border bg-secondary/20">
          <div className="text-[11px] font-medium text-muted-foreground">Data e hora</div>
          <div className="mt-1 text-base font-semibold text-card-foreground">{formatDateFriendly(message?.created_at)}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-secondary/20">
          <div className="text-[11px] font-medium text-muted-foreground">Tipo</div>
          <div className="mt-1 text-base font-semibold text-card-foreground">{messageTypeLabel}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-secondary/20">
          <div className="text-[11px] font-medium text-muted-foreground">Mensagens deste membro no grupo</div>
          <div className="mt-1 text-base font-semibold text-card-foreground tabular-nums">{memberMessageCount ?? 0}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-secondary/20">
          <div className="text-[11px] font-medium text-muted-foreground">Última atividade do remetente</div>
          <div className="mt-1 text-base font-semibold text-card-foreground">{formatDateFriendly(author?.last_seen_message_at || undefined)}</div>
        </div>
      </div>
    </section>
  );

  const body = (
    <div className={cn("flex flex-col", variant === "dialog" ? "h-[85vh]" : "h-full")}>
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-5 sm:px-6 py-4">
        {headerSection}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth px-5 sm:px-6 py-5">
        <div className="space-y-6">
          {contentSection}
          {contextSection}
          {quickInfoSection}
        </div>
      </div>
    </div>
  );

  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-3xl w-[90vw] p-0 overflow-hidden">
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-hidden">
        {body}
      </SheetContent>
    </Sheet>
  );
}

export default MessageDetailsDrawer;
