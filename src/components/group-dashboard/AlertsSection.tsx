import { ThumbsUp } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { SectionHeader } from "./SectionHeader";
import { InsightCard } from "./InsightCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserInline } from "@/components/ui/UserInline";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageDetailModal } from "@/components/messages/MessageDetailModal";

interface AtRiskMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
  daysSinceLastMessage: number;
}

interface PopularMessage {
  id: string;
  content: string | null;
  messageType: string;
  memberName: string;
  avatarUrl?: string | null;
  reactionCount: number;
  createdAt?: string | null;
}


interface AlertsSectionProps {
  atRiskMembers: AtRiskMember[];
  popularMessages: PopularMessage[];
  isLoading?: boolean;
  groupId?: string;
  totalMembers?: number;
}

export function AlertsSection({ 
  atRiskMembers, 
  popularMessages,
  isLoading,
  groupId,
  totalMembers = 0,
}: AlertsSectionProps) {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const { groupId: routeGroupId } = useParams();
  const currentGroup = (groupId || routeGroupId) as string | undefined;
  const translateMessageType = (type: string) => {
    const types: Record<string, string> = {
      text: 'Texto',
      image: 'Imagem',
      video: 'Vídeo',
      audio: 'Áudio',
      document: 'Documento',
      sticker: 'Figurinha',
    };
    return types[type] || type;
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

  const mentionIds = useMemo(() => {
    const allTexts = (popularMessages || []).map(m => (m.content || "").toString());
    const ids = allTexts.flatMap(src => Array.from(src.matchAll(/@([0-9]{5,})/g)).map(m => m[1]));
    return Array.from(new Set(ids));
  }, [popularMessages]);

  const { data: mentionMap } = useQuery({
    queryKey: ["alerts-mentions", currentGroup, mentionIds.join(",")],
    queryFn: async () => {
      if (!currentGroup || !mentionIds.length) return {} as Record<string, string>;
      const plusPhones = mentionIds.map(id => (id.startsWith("+") ? id : `+${id}`));
      const providerCandidates = [
        ...mentionIds,
        ...mentionIds.map(id => `${id}@c.us`),
        ...mentionIds.map(id => `${id}@s.whatsapp.net`),
      ];
      const { data: byProvider } = await supabase
        .from("members")
        .select("provider_member_id, name, display_name")
        .eq("group_id", currentGroup)
        .in("provider_member_id", providerCandidates);
      const { data: byPhone } = await supabase
        .from("members")
        .select("phone_e164, name, display_name")
        .eq("group_id", currentGroup)
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
    enabled: !!currentGroup && mentionIds.length > 0,
  });

 

  const handleViewDetail = async (msg: PopularMessage) => {
    setSelectedMessageId(msg.id);
  };

  

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Alertas e Oportunidades" 
        subtitle="Pontos de atenção para o gestor"
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : atRiskMembers.length === 0 ? (
            <InsightCard
              title="Sem membros sem participação no período"
              description="Todos tiveram alguma interação no período selecionado."
              severity="info"
            />
          ) : (
            <InsightCard
              title="Membros sem participação recente"
              description="Membros que não enviaram mensagens no período selecionado"
              severity="info"
              helpText="Membros sem mensagens no período selecionado. Isso não indica desinteresse por si só."
            >
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-card-foreground">{atRiskMembers.length}</span>
                  <span className="text-muted-foreground">({totalMembers > 0 ? Math.round((atRiskMembers.length / totalMembers) * 100) : 0}%)</span>
                </div>
                {atRiskMembers.slice(0, 3).map((member) => (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-card/50"
                  >
                    <UserInline name={member.name} avatarUrl={member.avatarUrl} />
                    <span className="text-xs text-muted-foreground">Sem atividade no período</span>
                  </div>
                ))}
                <div className="pt-1">
                  <Link to={groupId ? `/group/${groupId}/members` : '#'} className="text-xs text-primary hover:underline">
                    Ver lista completa
                  </Link>
                </div>
              </div>
            </InsightCard>
          )}
        </div>

        {/* Popular messages */}
        <div>
          <div className="rounded-lg border border-border bg-secondary/30 p-4 h-full">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-sm font-medium">O que engajou no grupo</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Mensagens que geraram mais reação no período</p>
            
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : popularMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma mensagem gerou reação no período.
              </p>
            ) : (
              <div className="space-y-3">
                {popularMessages.slice(0, 3).map((msg) => (
                  <div 
                    key={msg.id} 
                    className="p-3 rounded-lg bg-card/50 cursor-pointer hover:bg-card transition-colors"
                    onClick={() => handleViewDetail(msg)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleViewDetail(msg); }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {msg.memberName !== 'Desconhecido' && (
                        <UserInline name={msg.memberName} avatarUrl={msg.avatarUrl} size="xs" />
                      )}
                      {msg.messageType !== 'text' && (
                        <Badge variant="secondary" className="text-xs py-0 px-1.5">
                          {translateMessageType(msg.messageType)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-card-foreground line-clamp-2">
                      {renderTextWithMentionsAndLinks(
                        msg.content || `[${translateMessageType(msg.messageType)}]`,
                        mentionMap || {}
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        <span>{msg.reactionCount} reações</span>
                      </div>
                      {msg.createdAt && (
                        <span>• {new Date(msg.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <MessageDetailModal 
        open={!!selectedMessageId}
        onOpenChange={(open) => {
          if (!open) setSelectedMessageId(null);
        }}
        groupId={(groupId || routeGroupId) as string}
        messageId={selectedMessageId as string}
      />
    </section>
  );
}
