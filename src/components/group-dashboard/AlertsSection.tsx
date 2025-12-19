import { ThumbsUp, FileText, MapPin, Download, Activity } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { SectionHeader } from "./SectionHeader";
import { InsightCard } from "./InsightCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserInline } from "@/components/ui/UserInline";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

interface MessageDetail {
  id: string;
  content: string | null;
  text: string | null;
  message_type: string;
  member_id: string | null;
  member_name: string;
  member_avatar: string | null;
  created_at: string;
  provider_message_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_caption: string | null;
  media_duration_sec: number | null;
  media_size_bytes: number | null;
  thumbnail_url: string | null;
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
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const { groupId: routeGroupId } = useParams();
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

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleViewDetail = async (msg: PopularMessage) => {
    const currentGroup = groupId || routeGroupId;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('id', msg.id)
      .eq('group_id', currentGroup as string)
      .maybeSingle();

    if (data) {
      setSelectedMessage({
        id: data.id,
        content: data.content,
        text: data.text,
        message_type: data.message_type,
        member_id: data.member_id,
        member_name: msg.memberName,
        member_avatar: msg.avatarUrl || null,
        created_at: data.created_at,
        provider_message_id: data.provider_message_id,
        media_url: data.media_url,
        media_mime_type: data.media_mime_type,
        media_caption: data.media_caption,
        media_duration_sec: data.media_duration_sec,
        media_size_bytes: data.media_size_bytes,
        thumbnail_url: data.thumbnail_url,
      });
    }
  };

  const MessageDetailView = ({ message }: { message: MessageDetail }) => {
    const textContent = message.content || message.text;

    switch (message.message_type) {
      case 'image':
        return (
          <div className="space-y-3">
            {message.media_url && (
              <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="block">
                <img 
                  src={message.media_url} 
                  alt="Imagem" 
                  className="max-w-full max-h-[400px] rounded-lg object-contain bg-muted mx-auto cursor-zoom-in hover:opacity-90 transition-opacity"
                />
              </a>
            )}
            {message.media_caption && (
              <p className="text-sm text-card-foreground">{message.media_caption}</p>
            )}
            {message.media_size_bytes && (
              <p className="text-xs text-muted-foreground">
                Tamanho: {formatFileSize(message.media_size_bytes)}
              </p>
            )}
          </div>
        );

      case 'sticker':
        return (
          <div className="flex justify-center">
            {message.media_url && (
              <a href={message.media_url} target="_blank" rel="noopener noreferrer">
                <img 
                  src={message.media_url} 
                  alt="Sticker" 
                  className="max-w-[200px] max-h-[200px] object-contain cursor-zoom-in hover:scale-105 transition-transform"
                />
              </a>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-3">
            {message.media_url && (
              <audio controls className="w-full" src={message.media_url}>
                Seu navegador não suporta áudio.
              </audio>
            )}
            <div className="flex gap-4 text-xs text-muted-foreground">
              {message.media_duration_sec && (
                <span>Duração: {formatDuration(message.media_duration_sec)}</span>
              )}
              {message.media_size_bytes && (
                <span>Tamanho: {formatFileSize(message.media_size_bytes)}</span>
              )}
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-3">
            {message.media_url && (
              <video 
                controls 
                className="w-full max-h-[400px] rounded-lg bg-black"
                poster={message.thumbnail_url || undefined}
                src={message.media_url}
              >
                Seu navegador não suporta vídeo.
              </video>
            )}
            {message.media_caption && (
              <p className="text-sm text-card-foreground">{message.media_caption}</p>
            )}
            <div className="flex gap-4 text-xs text-muted-foreground">
              {message.media_duration_sec && (
                <span>Duração: {formatDuration(message.media_duration_sec)}</span>
              )}
              {message.media_size_bytes && (
                <span>Tamanho: {formatFileSize(message.media_size_bytes)}</span>
              )}
            </div>
          </div>
        );

      case 'document':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50">
              <FileText className="h-10 w-10 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">
                  {message.media_caption || 'Documento'}
                </p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {message.media_mime_type && <span>{message.media_mime_type}</span>}
                  {message.media_size_bytes && <span>{formatFileSize(message.media_size_bytes)}</span>}
                </div>
              </div>
              {message.media_url && (
                <a 
                  href={message.media_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10">
              <MapPin className="h-10 w-10 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium text-card-foreground">Localização compartilhada</p>
                {textContent && (
                  <p className="text-xs text-muted-foreground">{textContent}</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'poll':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10">
              <Activity className="h-10 w-10 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-card-foreground">Enquete</p>
                {textContent && (
                  <p className="text-sm text-card-foreground">{textContent}</p>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Para ver os detalhes, use a tela dedicada de Enquete.
            </div>
          </div>
        );

      case 'poll_vote':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50">
              <Activity className="h-10 w-10 text-secondary-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-card-foreground">Voto em enquete</p>
                {textContent && (
                  <p className="text-sm text-card-foreground">{textContent}</p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-3 rounded-lg bg-secondary/50 text-sm text-card-foreground whitespace-pre-wrap">
            {textContent || `[Mensagem do tipo ${translateMessageType(message.message_type)}]`}
          </div>
        );
    }
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
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Detalhes da Mensagem</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                      {translateMessageType(selectedMessage.message_type)}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Autor</span>
                  <div className="mt-1">
                    <UserInline name={selectedMessage.member_name} avatarUrl={selectedMessage.member_avatar} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Data</span>
                  <div className="mt-1">
                    {new Date(selectedMessage.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Conteúdo</span>
                <div className="mt-2">
                  <MessageDetailView message={selectedMessage} />
                </div>
              </div>

              <div className="flex justify-end">
                <Link to={`/group/${groupId || routeGroupId}/messages`} className="inline-flex items-center">
                  <Button variant="secondary">Ver na página de Mensagens</Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
