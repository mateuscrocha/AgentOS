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
import { UserInline } from "@/components/ui/UserInline";
import { Activity, FileText, Image, MapPin, Mic, Smile, Video, Shield, User, Database, Link as LinkIcon } from "lucide-react";

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
  return result;
};

export function MessageDetailModal({ open, onOpenChange, groupId, messageId }: MessageDetailModalProps) {
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
        .select("id, name, profile_pic_url, is_admin, is_owner, is_super_admin")
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
      const { data: byProvider } = await supabase
        .from("members")
        .select("provider_member_id, name, display_name")
        .eq("group_id", groupId)
        .in("provider_member_id", providerCandidates);
      const { data: byPhone } = await supabase
        .from("members")
        .select("phone_e164, name, display_name")
        .eq("group_id", groupId)
        .in("phone_e164", plusPhones);
      const map: Record<string, string> = {};
      const toDigits = (s: string) => s.replace(/\D/g, "");
      (byProvider || []).forEach(m => {
        const keyFull = (m as any).provider_member_id as string;
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
    const isAdmin = author?.is_admin || author?.is_owner || author?.is_super_admin;
    return isAdmin ? "Admin" : "Membro";
  }, [message, author]);

  const RoleIcon = useMemo(() => {
    if (!message?.member_id) return Database;
    const isAdmin = author?.is_admin || author?.is_owner || author?.is_super_admin;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Detalhes da Mensagem</DialogTitle>
        </DialogHeader>

        {!message ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                    {translateType(message.message_type)}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Autor</span>
                <div className="mt-1 flex items-center gap-2">
                  <UserInline name={author?.name || message.sender_name || "Desconhecido"} avatarUrl={(author as any)?.profile_pic_url || null} />
                  <Badge variant="secondary" className="flex items-center gap-1 text-[10px] px-1.5 py-0.5">
                    <RoleIcon className="h-3 w-3" />
                    {roleLabel}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Grupo</span>
                <div className="mt-1 text-card-foreground">
                  {group?.name || "-"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Data</span>
                <div className="mt-1">
                  {new Date(message.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">Conteúdo</span>
              <div className="mt-2">
                {message.message_type === "text" && (
                  <div className="p-3 rounded-lg bg-secondary/50 text-sm text-card-foreground whitespace-pre-wrap break-words">
                    {message.text
                      ? renderTextWithMentionsAndLinks(message.text, mentionMap || {})
                      : renderTextWithMentionsAndLinks(message.content || "[Texto]", mentionMap || {})}
                  </div>
                )}
                {message.message_type === "image" && (
                  <div className="space-y-3">
                    {message.media_url && (
                      <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={message.media_url} alt="Imagem" className="max-w-full max-h-[400px] rounded-lg object-contain bg-muted mx-auto cursor-zoom-in" />
                      </a>
                    )}
                    {message.media_caption && (
                      <p className="text-sm text-card-foreground">{message.media_caption}</p>
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
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {message.media_duration_sec && <span>Duração: {formatDuration(message.media_duration_sec)}</span>}
                      {(message.text || message.content) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/60">
                          <LinkIcon className="h-3 w-3" />
                          Transcrição disponível
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {message.message_type === "video" && (
                  <div className="space-y-3">
                    {message.media_url && (
                      <video controls className="w-full max-h-[400px] rounded-lg bg-black" poster={message.thumbnail_url || undefined} src={message.media_url} />
                    )}
                    {message.media_caption && (
                      <p className="text-sm text-card-foreground">{message.media_caption}</p>
                    )}
                  </div>
                )}
                {message.message_type === "sticker" && (
                  <div className="flex justify-center">
                    {message.media_url && (
                      <img src={message.media_url} alt="Sticker" className="max-w-[200px] max-h-[200px] object-contain" />
                    )}
                  </div>
                )}
                {message.message_type === "document" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50">
                      <FileText className="h-10 w-10 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{message.media_caption || "Documento"}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {message.media_mime_type && <span>{message.media_mime_type}</span>}
                          {message.media_size_bytes && <span>{formatFileSize(message.media_size_bytes)}</span>}
                        </div>
                      </div>
                      {message.media_url && (
                        <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-primary text-primary-foreground">
                          <FileText className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {!message.member_id && (
                  <div className="p-3 rounded-lg bg-secondary/40 text-sm text-muted-foreground">Mensagem de sistema</div>
                )}
              </div>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">Contexto da conversa</span>
              <div className="mt-2 space-y-2">
                {[...(contextBefore || []), ...(contextAfter || [])].length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem contexto disponível no período recente.</p>
                ) : (
                  <div className="space-y-2">
                    {contextBefore?.map((c) => (
                      <div key={`before-${c.message_id}`} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                            <span>•</span>
                            <span>{c.member_name || "Desconhecido"}</span>
                          </div>
                          <div className="text-sm text-card-foreground line-clamp-2">{c.content_preview || `[${translateType(c.message_type)}]`}</div>
                        </div>
                      </div>
                    ))}
                    {contextAfter?.map((c) => (
                      <div key={`after-${c.message_id}`} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                            <span>•</span>
                            <span>{c.member_name || "Desconhecido"}</span>
                          </div>
                          <div className="text-sm text-card-foreground line-clamp-2">{c.content_preview || `[${translateType(c.message_type)}]`}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="technical">
                <AccordionTrigger>Detalhes técnicos</AccordionTrigger>
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
                    {message.provider_message_id && (
                      <div>
                        <span className="text-muted-foreground">provider_message_id</span>
                        <p className="font-mono text-xs break-all">{message.provider_message_id}</p>
                      </div>
                    )}
                    {message.provider_chat_id && (
                      <div>
                        <span className="text-muted-foreground">provider_group_id</span>
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
                  {message.raw_provider && (
                    <div className="mt-3">
                      <span className="text-muted-foreground text-sm">Payload bruto</span>
                      <pre className="p-3 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-60 text-card-foreground">
                        {JSON.stringify(message.raw_provider, null, 2)}
                      </pre>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
