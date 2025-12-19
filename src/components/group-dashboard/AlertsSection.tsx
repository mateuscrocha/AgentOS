import { AlertTriangle, MessageSquare, ThumbsUp, User } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionHeader } from "./SectionHeader";
import { InsightCard } from "./InsightCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserInline } from "@/components/ui/UserInline";

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
                    className="p-3 rounded-lg bg-card/50"
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
                      {msg.content || `[${translateMessageType(msg.messageType)}]`}
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
    </section>
  );
}
