import { AlertTriangle, MessageSquare, ThumbsUp, User } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { InsightCard } from "./InsightCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface AtRiskMember {
  id: string;
  name: string;
  daysSinceLastMessage: number;
}

interface PopularMessage {
  id: string;
  content: string | null;
  messageType: string;
  memberName: string;
  reactionCount: number;
}

interface AlertsSectionProps {
  atRiskMembers: AtRiskMember[];
  popularMessages: PopularMessage[];
  isLoading?: boolean;
}

export function AlertsSection({ 
  atRiskMembers, 
  popularMessages,
  isLoading 
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
        {/* At-risk members */}
        <div>
          {isLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : atRiskMembers.length === 0 ? (
            <InsightCard
              title="Nenhum membro em risco identificado"
              description="Todos os membros estão participando ativamente."
              severity="success"
            />
          ) : (
            <InsightCard
              title={`${atRiskMembers.length} membro${atRiskMembers.length > 1 ? 's' : ''} em risco de desengajamento`}
              description="Membros que não enviam mensagens há mais de 7 dias."
              severity="warning"
            >
              <div className="space-y-2 mt-2">
                {atRiskMembers.slice(0, 5).map((member) => (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-card/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span className="text-sm text-card-foreground truncate max-w-[150px]">
                        {member.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {member.daysSinceLastMessage}d sem atividade
                    </span>
                  </div>
                ))}
                {atRiskMembers.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{atRiskMembers.length - 5} outros membros
                  </p>
                )}
              </div>
            </InsightCard>
          )}
        </div>

        {/* Popular messages */}
        <div>
          <div className="rounded-lg border border-border bg-secondary/30 p-4 h-full">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-sm font-medium">Mensagens populares</span>
            </div>
            
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : popularMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma mensagem com reações ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {popularMessages.slice(0, 5).map((msg) => (
                  <div 
                    key={msg.id} 
                    className="p-3 rounded-lg bg-card/50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-primary">
                        {msg.memberName}
                      </span>
                      {msg.messageType !== 'text' && (
                        <Badge variant="secondary" className="text-xs py-0 px-1.5">
                          {translateMessageType(msg.messageType)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-card-foreground line-clamp-2">
                      {msg.content || `[${translateMessageType(msg.messageType)}]`}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <ThumbsUp className="h-3 w-3" />
                      <span>{msg.reactionCount} reações</span>
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
