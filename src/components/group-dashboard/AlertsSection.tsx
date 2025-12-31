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
import { MessageDetailsDrawer } from "@/components/messages/MessageDetailsDrawer";

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
  ikigaiSuggestions?: { themes: { phrase: string; count: number }[]; keywords: { term: string; count: number }[] } | null;
}

export function AlertsSection({ 
  atRiskMembers, 
  popularMessages,
  isLoading,
  groupId,
  totalMembers = 0,
  ikigaiSuggestions,
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
        .select("whatsapp_provider_id, name, display_name")
        .eq("group_id", currentGroup)
        .in("whatsapp_provider_id", providerCandidates);
      const { data: byPhone } = await supabase
        .from("members")
        .select("phone_e164, name, display_name")
        .eq("group_id", currentGroup)
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
    enabled: !!currentGroup && mentionIds.length > 0,
  });

 

  const handleViewDetail = async (msg: PopularMessage) => {
    setSelectedMessageId(msg.id);
  };

  

  const themes = (ikigaiSuggestions?.themes || []).slice(0, 3);
  const hasProblems = atRiskMembers.length > 0;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Alertas e Oportunidades" 
        subtitle="Pontos de atenção para o gestor"
      />

      <div className="space-y-4">
        {hasProblems ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-card-foreground mb-2">🔴 Problemas detectados</p>
            <div className="space-y-1">
              <p className="text-sm text-card-foreground">{atRiskMembers.length} membros não tiveram atividade neste período <span className="text-xs text-muted-foreground">({totalMembers > 0 ? Math.round((atRiskMembers.length / totalMembers) * 100) : 0}%)</span></p>
            </div>
            <Link to={groupId ? `/groups/${groupId}/members` : '#'} className="mt-3 text-xs text-primary hover:underline">Ver detalhes</Link>
          </div>
        ) : (
          <div className="rounded-xl border border-success/30 bg-success/5 p-4">
            <p className="text-sm font-semibold text-card-foreground">🟢 Nenhum problema detectado neste período</p>
          </div>
        )}

        {themes.length > 0 && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-4">
            <p className="text-sm font-semibold text-card-foreground mb-2">🟢 Temas em alta</p>
            <div className="space-y-1">
              {themes.map((t) => (
                <p key={t.phrase} className="text-sm text-card-foreground">Tema em alta: “{t.phrase}”</p>
              ))}
            </div>
            <Link to={groupId ? `/groups/${groupId}#proposito` : '#'} className="mt-3 text-xs text-primary hover:underline">Ver detalhes</Link>
          </div>
        )}
      </div>

      <MessageDetailsDrawer 
        open={!!selectedMessageId}
        onOpenChange={(open) => {
          if (!open) setSelectedMessageId(null);
        }}
        groupId={(groupId || routeGroupId) as string}
        messageId={selectedMessageId as string}
        variant="sheet"
      />
    </section>
  );
}
