import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { Activity, FileText, Image, MapPin, Mic, Smile, Video, Shield, User, Database, Link as LinkIcon, Calendar, Users, Globe, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { applyWhatsAppStylesToParts, formatWhatsAppStyles } from "@/lib/whatsapp-format";

interface MessageDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  messageId: string;
}

const translateType = (type: string) => {
  const map: Record<string, string> = {
    text: "Texto",
    image: "Imagem",
    audio: "Áudio",
    video: "Vídeo",
    document: "Documento",
    sticker: "Figurinha",
    location: "Localização",
    poll: "Enquete",
    poll_vote: "Voto",
    system: "Sistema",
  };
  return map[type] || type;
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "image": return Image;
    case "audio": return Mic;
    case "video": return Video;
    case "document": return FileText;
    case "sticker": return Smile;
    case "location": return MapPin;
    case "poll": return Activity;
    case "poll_vote": return Activity;
    default: return FileText;
  }
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const linkOrMentionRegex = /(https?:\/\/[^\s]+)|@([0-9]{5,})/g;
const renderTextWithMentionsAndLinks = (text: string, mentionMap: Record<string, string>) => {
  const result: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(linkOrMentionRegex)) {
    const idx = match.index || 0;
    if (idx > lastIndex) {
      result.push(text.slice(lastIndex, idx));
    }
    const url = match[1];
    const mentionId = match[2];
    if (url) {
      result.push(
        <a key={`u-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
          {url}
        </a>
      );
    } else if (mentionId) {
      const name = mentionMap[mentionId];
      if (name) {
        result.push(
          <span key={`m-${idx}`} className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
            @{name}
          </span>
        );
      } else {
        result.push(`@${mentionId}`);
      }
    }
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return applyWhatsAppStylesToParts(result);
};

export function MessageDetailModal({ open, onOpenChange, groupId, messageId }: MessageDetailModalProps) {
  const { isSystemAdmin } = useUserRoles();
  const { data: message } = useQuery({
    queryKey: ["modal-message", groupId, messageId],
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

  const replyProviderId = useMemo(() => {
    if (!message) return null;
    return (message.reply_to_whatsapp_provider_id || message.reference_message_id || null) as string | null;
  }, [message]);

  const { data: repliedMessage } = useQuery({
    queryKey: ["modal-replied-message", groupId, replyProviderId],
    queryFn: async () => {
      if (!replyProviderId) return null;
      const { data } = await (supabase as any)
        .from("messages")
        .select("id, member_id, sender_name, text, content, message_type, created_at, media_caption")
        .eq("group_id", groupId)
        .eq("whatsapp_provider_id", replyProviderId)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!groupId && !!replyProviderId,
  });

  const { data: repliedAuthor } = useQuery({
    queryKey: ["modal-replied-author", groupId, repliedMessage?.member_id],
    queryFn: async () => {
      if (!repliedMessage?.member_id) return null;
      const { data } = await supabase
        .from("members")
        .select("id, name, profile_pic_url")
        .eq("group_id", groupId)
        .eq("id", repliedMessage.member_id)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!groupId && !!repliedMessage?.member_id,
  });

  const { data: group } = useQuery({
    queryKey: ["modal-group", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("id, name")
        .eq("id", groupId)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!groupId,
  });

  const { data: author } = useQuery({
    queryKey: ["modal-author", groupId, message?.member_id],
    queryFn: async () => {
      if (!message?.member_id) return null;
      const { data } = await supabase
        .from("members")
        .select("id, name, profile_pic_url, is_admin, is_super_admin")
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
    queryKey: ["modal-mentions", groupId, mentionIds.join(",")],
    queryFn: async () => {
      if (!mentionIds.length) return {} as Record<string, string>;
      const plusPhones = mentionIds.map(id => (id.startsWith("+") ? id : `+${id}`));
      const providerCandidates = [
        ...mentionIds,
        ...mentionIds.map(id => `${id}@c.us`),
        ...mentionIds.map(id => `${id}@s.whatsapp.net`),
      ];
      const { data: byProvider } = await (supabase as any)
        .from("members")
        .select("whatsapp_provider_id, name, display_name")
        .eq("group_id", groupId)
        .in("whatsapp_provider_id", providerCandidates);
      const { data: byPhone } = await (supabase as any)
        .from("members")
        .select("phone_e164, name, display_name")
        .eq("group_id", groupId)
        .in("phone_e164", plusPhones);
      const map: Record<string, string> = {};
      const toDigits = (s: string) => s.replace(/\D/g, "");
      (byProvider || []).forEach(m => {
        const keyFull = (m as any).whatsapp_provider_id as string;
        const key = toDigits(keyFull || "");
        const val = ((m as any).display_name as string) || ((m as any).name as string);
        if (key) map[key] = val;
      });
      (byPhone || []).forEach(m => {
        const phone = ((m as any).phone_e164 as string) || "";
        const key = phone.replace(/^\+/, "");
        const val = ((m as any).display_name as string) || ((m as any).name as string);
        if (key) map[key] = val;
      });
      return map;
    },
    enabled: open && !!groupId && mentionIds.length > 0,
  });

  const roleLabel = useMemo(() => {
    if (!message) return "";
    if (!message.member_id) return "Sistema";
    const isAdmin = author?.is_admin || author?.is_super_admin;
    return isAdmin ? "Admin" : "Membro";
  }, [message, author]);

  const RoleIcon = useMemo(() => {
    if (!message?.member_id) return Database;
    const isAdmin = author?.is_admin || author?.is_super_admin;
    return isAdmin ? Shield : User;
  }, [message, author]);

  const { data: contextBefore } = useQuery({
    queryKey: ["modal-context-before", groupId, message?.created_at],
    queryFn: async () => {
      if (!message?.created_at) return [];
      const { data } = await supabase
        .from("v_messages_feed")
        .select("message_id, member_name, content_preview, message_type, created_at")
        .eq("group_id", groupId)
        .lt("created_at", message.created_at)
        .order("created_at", { ascending: false })
        .limit(3);
      return (data ?? []) as any[];
    },
    enabled: open && !!groupId && !!message?.created_at,
  });

  const { data: contextAfter } = useQuery({
    queryKey: ["modal-context-after", groupId, message?.created_at],
    queryFn: async () => {
      if (!message?.created_at) return [];
      const { data } = await supabase
        .from("v_messages_feed")
        .select("message_id, member_name, content_preview, message_type, created_at")
        .eq("group_id", groupId)
        .gt("created_at", message.created_at)
        .order("created_at", { ascending: true })
        .limit(3);
      return (data ?? []) as any[];
    },
    enabled: open && !!groupId && !!message?.created_at,
  });

  const TypeIcon = getTypeIcon(message?.message_type || "text");

  const contextRows = useMemo(() => {
    if (!message) return { before: [], after: [] };
    const before = [...(contextBefore || [])].reverse();
    const after = [...(contextAfter || [])];
    return { before, after };
  }, [contextBefore, contextAfter, message]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-[880px] p-0 overflow-hidden">
        <div className="flex flex-col max-h-[85vh]">
          <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-5 sm:px-6 py-4">
            <DialogTitle className="text-base text-card-foreground pr-10">Detalhes da Mensagem</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto scroll-smooth px-5 sm:px-6 py-5">
            {!message ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <div className="space-y-5">
                <section className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5 shadow-sm">
                  <h3 className="text-[15px] font-medium text-muted-foreground mb-2">Cabeçalho da mensagem</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-muted-foreground">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">Remetente</div>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            {author?.id ? (
                              <MemberInlineTrigger memberId={author.id} groupId={groupId} name={author?.name || message.sender_name || "Desconhecido"} avatarUrl={(author as any)?.profile_pic_url || null} />
                            ) : (
                              <span className="text-sm text-card-foreground truncate">{author?.name || message.sender_name || "Desconhecido"}</span>
                            )}
                            <Badge variant="secondary" className="flex items-center gap-1 text-[10px] px-1.5 py-0.5">
                              <RoleIcon className="h-3 w-3" />
                              {roleLabel}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Data e hora</div>
                          <div className="mt-1 text-sm text-card-foreground">{new Date(message.created_at).toLocaleString("pt-BR")}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-muted-foreground">
                          <Globe className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">Grupo</div>
                          <div className="mt-1 text-sm text-card-foreground truncate">{group?.name || "-"}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <TypeIcon className="h-3.5 w-3.5" />
                            Tipo
                          </div>
                          <div className="mt-1 text-sm text-card-foreground">{translateType(message.message_type)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <DirectionIcon className="h-3.5 w-3.5" />
                            Direção
                          </div>
                          <div className="mt-1 text-sm text-card-foreground">{directionLabel}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-[15px] font-medium text-muted-foreground">Conteúdo da mensagem</h3>

                  {replyProviderId && (
                    <div className="rounded-xl border border-border bg-muted/10 p-4">
                      <div className="text-xs text-muted-foreground">Em resposta a</div>
                      {repliedMessage ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {repliedMessage.member_id ? (
                              <MemberInlineTrigger
                                memberId={repliedMessage.member_id}
                                groupId={groupId}
                                name={repliedAuthor?.name || repliedMessage.sender_name || "Desconhecido"}
                                avatarUrl={(repliedAuthor as any)?.profile_pic_url || null}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">Sistema</span>
                            )}
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{new Date(repliedMessage.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <div className="text-sm text-card-foreground line-clamp-3 whitespace-pre-wrap break-words">
                            {repliedMessage.message_type === "system"
                              ? formatWhatsAppStyles(
                                  (repliedMessage.text || repliedMessage.content || repliedMessage.media_caption || "").toString().trim() ||
                                    `[${translateType(repliedMessage.message_type || "text")}]`
                                )
                              : ((repliedMessage.text || repliedMessage.content || repliedMessage.media_caption || "").toString().trim() ||
                                  `[${translateType(repliedMessage.message_type || "text")}]`)}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">Mensagem original não encontrada no banco.</div>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl border border-border bg-secondary/30 p-4 sm:p-5 shadow-sm">
                    {(message.message_type === "text" || message.message_type === "system") && (
                      <div className="text-[15px] leading-relaxed text-card-foreground whitespace-pre-wrap break-words">
                        {message.text
                          ? renderTextWithMentionsAndLinks(message.text, mentionMap || {})
                          : renderTextWithMentionsAndLinks(message.content || "[Texto]", mentionMap || {})}
                      </div>
                    )}
                    {message.message_type === "image" && (
                      <div className="space-y-3">
                        {message.media_url && (
                          <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
                            <img src={message.media_url} alt="Imagem" className="max-w-full max-h-[420px] rounded-lg object-contain bg-muted mx-auto cursor-zoom-in" />
                          </a>
                        )}
                        {message.media_caption && (
                          <p className="text-[15px] leading-relaxed text-card-foreground">{message.media_caption}</p>
                        )}
                        {message.media_size_bytes && (
                          <p className="text-xs text-muted-foreground">Tamanho: {formatFileSize(message.media_size_bytes)}</p>
                        )}
                      </div>
                    )}
                    {message.message_type === "audio" && (
                      <div className="space-y-2">
                        {message.media_url && (
                          <audio controls className="w-full" src={message.media_url} />
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {message.media_duration_sec && <span>Duração: {formatDuration(message.media_duration_sec)}</span>}
                          {(message.text || message.content) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background/60 border border-border">
                              <CheckCircle2 className="h-3 w-3" />
                              Transcrição disponível
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {message.message_type === "video" && (
                      <div className="space-y-3">
                        {message.media_url && (
                          <video controls className="w-full max-h-[420px] rounded-lg bg-black" poster={message.thumbnail_url || undefined} src={message.media_url} />
                        )}
                        {message.media_caption && (
                          <p className="text-[15px] leading-relaxed text-card-foreground">{message.media_caption}</p>
                        )}
                      </div>
                    )}
                    {message.message_type === "sticker" && (
                      <div className="flex justify-center">
                        {message.media_url && (
                          <img src={message.media_url} alt="Sticker" className="max-w-[220px] max-h-[220px] object-contain" />
                        )}
                      </div>
                    )}
                    {message.message_type === "document" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-background/50">
                          <FileText className="h-10 w-10 text-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-card-foreground truncate">{message.media_caption || "Documento"}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              {message.media_mime_type && <span>{message.media_mime_type}</span>}
                              {message.media_size_bytes && <span>{formatFileSize(message.media_size_bytes)}</span>}
                            </div>
                          </div>
                          {message.media_url && (
                            <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <LinkIcon className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {!message.member_id && (
                      <div className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground">Mensagem de sistema</div>
                    )}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-[15px] font-medium text-muted-foreground">Conversa em contexto</h3>
                  <div className="rounded-xl border border-border bg-muted/10 p-3 sm:p-4 shadow-sm">
                    {[...contextRows.before, ...contextRows.after].length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem contexto disponível no período recente.</p>
                    ) : (
                      <div className="max-h-[320px] overflow-y-auto scroll-smooth pr-2">
                        <div className="space-y-2">
                          {contextRows.before.map((c: any) => (
                            <div key={`before-${c.message_id}`} className="rounded-lg px-3 py-2 hover:bg-background/40 transition-colors">
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                                <span className="text-muted-foreground/60">•</span>
                                <span className="truncate">{c.member_name || "Desconhecido"}</span>
                              </div>
                              <div className="mt-1 text-sm text-card-foreground line-clamp-2 whitespace-pre-wrap break-words">
                                {c.message_type === "system"
                                  ? formatWhatsAppStyles(c.content_preview || `[${translateType(c.message_type)}]`)
                                  : (c.content_preview || `[${translateType(c.message_type)}]`)}
                              </div>
                            </div>
                          ))}

                          <div className="rounded-lg border border-border bg-primary/5 px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{new Date(message.created_at).toLocaleString("pt-BR")}</span>
                              <span className="text-muted-foreground/60">•</span>
                              <span className="truncate">{author?.name || message.sender_name || "Desconhecido"}</span>
                              <span className="ml-auto text-[11px] text-primary">Selecionada</span>
                            </div>
                            <div className="mt-1 text-sm text-card-foreground whitespace-pre-wrap break-words">
                              {message.message_type === "system"
                                ? formatWhatsAppStyles(
                                    (message.text || message.content || message.media_caption || "").toString().trim() || `[${translateType(message.message_type)}]`
                                  )
                                : ((message.text || message.content || message.media_caption || "").toString().trim() || `[${translateType(message.message_type)}]`)}
                            </div>
                          </div>

                          {contextRows.after.map((c: any) => (
                            <div key={`after-${c.message_id}`} className="rounded-lg px-3 py-2 hover:bg-background/40 transition-colors">
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                                <span className="text-muted-foreground/60">•</span>
                                <span className="truncate">{c.member_name || "Desconhecido"}</span>
                              </div>
                              <div className="mt-1 text-sm text-card-foreground line-clamp-2 whitespace-pre-wrap break-words">
                                {c.message_type === "system"
                                  ? formatWhatsAppStyles(c.content_preview || `[${translateType(c.message_type)}]`)
                                  : (c.content_preview || `[${translateType(c.message_type)}]`)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-[15px] font-medium text-muted-foreground">Informações rápidas</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border bg-muted/10 px-4 py-3">
                      <div className="text-[11px] text-muted-foreground">Origem</div>
                      <div className="mt-1 text-sm text-card-foreground capitalize">{(message.provider || "-").toString()}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/10 px-4 py-3">
                      <div className="text-[11px] text-muted-foreground">Status</div>
                      <div className="mt-1 text-sm text-card-foreground">{(message.delivery_status || message.status || "-").toString()}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/10 px-4 py-3">
                      <div className="text-[11px] text-muted-foreground">ID</div>
                      <div className="mt-1 text-sm text-card-foreground font-mono truncate">{message.id}</div>
                    </div>
                  </div>
                </section>

                <Accordion type="single" collapsible>
                  <AccordionItem value="technical" className="border-border">
                    <AccordionTrigger className="text-sm">Detalhes técnicos</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">ID da mensagem</span>
                          <p className="font-mono text-xs break-all">{message.id}</p>
                        </div>
                        {message.provider && (
                          <div>
                            <span className="text-muted-foreground">Provider</span>
                            <p className="capitalize">{message.provider}</p>
                          </div>
                        )}
                        {isSystemAdmin && message.provider_message_id && (
                          <div>
                            <span className="text-muted-foreground">provider_message_id</span>
                            <p className="font-mono text-xs break-all">{message.provider_message_id}</p>
                          </div>
                        )}
                        {isSystemAdmin && message.provider_chat_id && (
                          <div>
                            <span className="text-muted-foreground">provider_chat_id</span>
                            <p className="font-mono text-xs break-all">{message.provider_chat_id}</p>
                          </div>
                        )}
                        {message.type && (
                          <div>
                            <span className="text-muted-foreground">Tipo original</span>
                            <p className="font-mono text-xs break-all">{message.type}</p>
                          </div>
                        )}
                        {message.status && (
                          <div>
                            <span className="text-muted-foreground">Status</span>
                            <p className="font-mono text-xs break-all">{message.status}</p>
                          </div>
                        )}
                        {message.message_ts && (
                          <div>
                            <span className="text-muted-foreground">Timestamp original</span>
                            <p className="font-mono text-xs break-all">{message.message_ts}</p>
                          </div>
                        )}
                      </div>
                      {isSystemAdmin && message.raw_provider && (
                        <div className="mt-3">
                          <span className="text-muted-foreground text-sm">Payload bruto</span>
                          <pre className="p-3 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-60 text-card-foreground">
                            {JSON.stringify(message.raw_provider, null, 2)}
                          </pre>
                        </div>
                      )}
                      {!isSystemAdmin && (
                        <div className="mt-3">
                          <span className="text-muted-foreground text-sm">Dados técnicos restritos</span>
                          <p className="text-xs text-muted-foreground">Alguns identificadores e payloads do provider estão ocultos.</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
