import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { useUserRoles } from "@/hooks/use-user-roles";
import { formatDateTimeBR } from "@/lib/date";
import { X, Link as LinkIcon, Image, Mic, Video, FileText, MessageSquare } from "lucide-react";

type Variant = "sheet" | "dialog";

type MessageDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  groupId: string;
  variant?: Variant;
};

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
    default: return MessageSquare;
  }
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
        <a key={`u-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{url}</a>
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
  return result;
};

export function MessageDetailsDrawer({ open, onOpenChange, groupId, messageId, variant = "sheet" }: MessageDetailsDrawerProps) {
  const { isSystemAdmin } = useUserRoles();

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
        .select("id,name,display_name,profile_pic_url,is_admin,is_owner,is_super_admin,last_seen_message_at")
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
      const plusPhones = mentionIds.map(id => (id.startsWith("+") ? id : `+${id}`));
      const providerCandidates = [
        ...mentionIds,
        ...mentionIds.map(id => `${id}@c.us`),
        ...mentionIds.map(id => `${id}@s.whatsapp.net`),
      ];
      const { data: byProvider } = await supabase
        .from("members")
        .select("whatsapp_provider_id,name,display_name")
        .eq("group_id", groupId)
        .in("whatsapp_provider_id", providerCandidates);
      const { data: byPhone } = await supabase
        .from("members")
        .select("phone_e164,name,display_name")
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
    if (!message.member_id) return "Sistema";
    const isAdmin = author?.is_admin || author?.is_owner || author?.is_super_admin;
    return isAdmin ? "Administrador do grupo" : "Membro";
  }, [message, author]);

  const TypeIcon = getTypeIcon(message?.message_type || "text");

  const originLabel = useMemo(() => {
    const p = (message as any)?.provider;
    const src = (message as any)?.metadata?.source;
    if (p === "manual_import" || src === "manual_import") return "Importação manual";
    return "Conversa em tempo real";
  }, [message]);

  const classificationLabel = useMemo(() => {
    const txt = ((message?.text || message?.content || "") as string).toLowerCase();
    if (!txt.trim()) return "Texto";
    if (txt.includes("http://") || txt.includes("https://")) return "Link";
    if (txt.length > 3000) return "Texto longo";
    return "Texto";
  }, [message]);

  const closeButton = (
    <button
      className="absolute right-3 top-3 p-2 rounded-md hover:bg-secondary"
      onClick={() => onOpenChange(false)}
      aria-label="Fechar"
    >
      <X className="h-4 w-4 text-muted-foreground" />
    </button>
  );

  const headerSection = (
    <div className="relative">
      {closeButton}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-card-foreground">Detalhes da mensagem</h3>
        {messageLoading ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : messageError ? (
          <div className="p-3 rounded-md bg-destructive/10 text-sm text-destructive">
            Não foi possível carregar os detalhes desta mensagem. Tente novamente.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Remetente</div>
              <div className="mt-1 flex items-center gap-2">
                {message?.member_id ? (
                  <MemberInlineTrigger memberId={message.member_id} groupId={groupId} name={author?.display_name || author?.name || message.sender_name || "Membro"} avatarUrl={(author as any)?.profile_pic_url || null} />
                ) : (
                  <span className="text-muted-foreground">Sistema</span>
                )}
                {roleLabel && (
                  <Badge variant="secondary" className="text-[11px]">{roleLabel}</Badge>
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Data e hora</div>
              <div className="mt-1 text-card-foreground">{formatDateFriendly(message?.created_at)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Grupo</div>
              <div className="mt-1"><a href={`/groups/${groupId}`} className="text-primary hover:underline">{group?.name || "Grupo"}</a></div>
            </div>
            <div>
              <div className="text-muted-foreground">Origem</div>
              <div className="mt-1 text-card-foreground">{originLabel}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const contentSection = (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">Conteúdo da mensagem</div>
      {messageLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !message ? (
        <div className="text-xs text-muted-foreground">Sem conteúdo</div>
      ) : (
        <div className="rounded-lg border border-border bg-secondary/40 p-3 max-h-[320px] overflow-auto text-sm text-card-foreground whitespace-pre-wrap break-words">
          {message.message_type === "text" ? (
            message.text ? renderTextWithMentionsAndLinks(message.text, mentionMap || {}) : renderTextWithMentionsAndLinks(message.content || "[Texto]", mentionMap || {})
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <LinkIcon className="h-4 w-4" />
              Mensagem com mídia
            </div>
          )}
        </div>
      )}
    </div>
  );

  const contextSection = (
    <div className="space-y-2">
      <div className="text-sm font-medium text-card-foreground">Contexto na conversa</div>
      {messageLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <div className="space-y-2">
          {[...(contextBefore || []), ...(contextAfter || [])].length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem mensagens próximas.</p>
          ) : (
            <div className="space-y-2">
              {contextBefore?.map((c) => (
                <div key={`before-${c.message_id}`} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatDateFriendly(c.created_at)}</span>
                      <span>•</span>
                      <span>{c.member_name || "Desconhecido"}</span>
                    </div>
                    <div className="text-sm text-card-foreground line-clamp-2">{c.content_preview || `[${translateType(c.message_type)}]`}</div>
                  </div>
                </div>
              ))}
              <div className="p-2 rounded-md bg-primary/10 border border-primary/20">
                <div className="text-xs text-muted-foreground">Mensagem selecionada</div>
                <div className="text-sm text-card-foreground line-clamp-3">{(message?.text || message?.content || "[Mensagem]") as string}</div>
              </div>
              {contextAfter?.map((c) => (
                <div key={`after-${c.message_id}`} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatDateFriendly(c.created_at)}</span>
                      <span>•</span>
                      <span>{c.member_name || "Desconhecido"}</span>
                    </div>
                    <div className="text-sm text-card-foreground line-clamp-2">{c.content_preview || `[${translateType(c.message_type)}]`}</div>
                  </div>
                </div>
              ))}
              <div className="flex justify-end">
                <a href={`/groups/${groupId}/messages`} className="text-xs text-primary hover:underline">Ver na conversa completa</a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const quickInfoSection = (
    <div className="space-y-2">
      <div className="text-sm font-medium text-card-foreground">Informações rápidas</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground">Remetente</div>
          <div className="mt-1">
            {message?.member_id ? (
              <MemberInlineTrigger memberId={message.member_id} groupId={groupId} name={author?.display_name || author?.name || message.sender_name || "Membro"} avatarUrl={(author as any)?.profile_pic_url || null} variant="sheet" />
            ) : (
              <span className="text-muted-foreground">Sistema</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Grupo</div>
          <div className="mt-1"><a href={`/groups/${groupId}`} className="text-primary hover:underline">{group?.name || "Grupo"}</a></div>
        </div>
        <div>
          <div className="text-muted-foreground">Tipo de mensagem</div>
          <div className="mt-1">{message?.message_type === "text" ? classificationLabel : translateType(message?.message_type || "text")}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Mensagens deste membro neste grupo</div>
          <div className="mt-1">{memberMessageCount ?? 0}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Última atividade deste membro</div>
          <div className="mt-1">{formatDateFriendly(author?.last_seen_message_at || undefined)}</div>
        </div>
      </div>
    </div>
  );

  const keywordsSection = (
    <div className="space-y-2">
      <div className="text-sm font-medium text-card-foreground">Assuntos desta mensagem</div>
      {(() => {
        const text = ((message?.text || message?.content || "") as string);
        const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        const stop = new Set(["de","da","do","e","a","o","um","uma","para","por","em","no","na","nos","nas","que","se","com","sem","mais","menos"]);
        const counts: Record<string, number> = {};
        for (const t of tokens) {
          if (t.length < 3) continue;
          if (stop.has(t)) continue;
          counts[t] = (counts[t] || 0) + 1;
        }
        const items = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
        if (items.length === 0) return <div className="text-xs text-muted-foreground">Sem assuntos detectados.</div>;
        return (
          <div className="flex flex-wrap gap-2">
            {items.map(([term, count]) => (
              <a key={term} href={`/groups/${groupId}/messages`} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80">
                {term}
              </a>
            ))}
          </div>
        );
      })()}
    </div>
  );

  const actionsSection = (
    <div className="space-y-2">
      <div className="text-sm font-medium text-card-foreground">Ações</div>
      <div className="flex flex-wrap gap-2">
        {message?.member_id ? (
          <a href={`/groups/${groupId}/messages`} className="px-2 py-1 rounded-md bg-card border border-border text-xs hover:bg-secondary">
            Ver todas as mensagens deste membro neste grupo
          </a>
        ) : null}
        <a href={`/groups/${groupId}/messages`} className="px-2 py-1 rounded-md bg-card border border-border text-xs hover:bg-secondary">
          Ver esta mensagem na linha do tempo
        </a>
      </div>
    </div>
  );

  const advancedSection = isSystemAdmin ? (
    <Tabs defaultValue="details" className="mt-2">
      <TabsList>
        <TabsTrigger value="details">Detalhes</TabsTrigger>
        <TabsTrigger value="advanced">Avançado</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="mt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">ID da mensagem</div>
            <div className="font-mono text-xs break-all">{message?.id || ""}</div>
          </div>
          {message?.member_id ? (
            <div>
              <div className="text-muted-foreground">ID do remetente</div>
              <div className="font-mono text-xs break-all">{message?.member_id}</div>
            </div>
          ) : null}
          <div>
            <div className="text-muted-foreground">ID do grupo</div>
            <div className="font-mono text-xs break-all">{groupId}</div>
          </div>
          {message?.message_ts ? (
            <div>
              <div className="text-muted-foreground">Horário bruto</div>
              <div className="font-mono text-xs break-all">{message.message_ts}</div>
            </div>
          ) : null}
          {message?.status ? (
            <div>
              <div className="text-muted-foreground">Status interno</div>
              <div className="font-mono text-xs break-all">{message.status}</div>
            </div>
          ) : null}
          {message?.provider ? (
            <div>
              <div className="text-muted-foreground">Origem exata</div>
              <div className="font-mono text-xs break-all">{message.provider}</div>
            </div>
          ) : null}
        </div>
        {(message as any)?.raw_provider ? (
          <div className="mt-3">
            <div className="text-muted-foreground text-sm">Dados brutos do provedor</div>
            <pre className="p-3 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-60 text-card-foreground">{JSON.stringify((message as any).raw_provider, null, 2)}</pre>
          </div>
        ) : null}
      </TabsContent>
      <TabsContent value="advanced" className="mt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {(message as any)?.provider_message_id ? (
            <div>
              <div className="text-muted-foreground">ID da mensagem no provedor</div>
              <div className="font-mono text-xs break-all">{(message as any).provider_message_id}</div>
            </div>
          ) : null}
          {(message as any)?.provider_chat_id ? (
            <div>
              <div className="text-muted-foreground">ID do grupo no provedor</div>
              <div className="font-mono text-xs break-all">{(message as any).provider_chat_id}</div>
            </div>
          ) : null}
        </div>
      </TabsContent>
    </Tabs>
  ) : null;

  const body = (
    <div className="space-y-6">
      {headerSection}
      {contentSection}
      {contextSection}
      {quickInfoSection}
      {keywordsSection}
      {actionsSection}
      {advancedSection}
    </div>
  );

  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-3xl w-[90vw]">
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        {body}
      </SheetContent>
    </Sheet>
  );
}

export default MessageDetailsDrawer;
