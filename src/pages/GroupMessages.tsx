import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams, NavLink } from "react-router-dom";
import { 
  Users, MessageSquare, Filter, Eye, Activity, 
  Image, Mic, Video, FileText, MapPin, Smile, Download 
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReactionBadges } from "@/components/messages/ReactionBadges";
import { ReactionDetails } from "@/components/messages/ReactionDetails";

const PAGE_SIZE = 10;

interface MessageFeed {
  message_id: string;
  group_id: string;
  created_at: string;
  message_type: string;
  content_preview: string | null;
  member_id: string | null;
  member_name: string;
  provider_message_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  thumbnail_url: string | null;
}

interface ReactionSummary {
  message_id: string;
  emoji: string;
  count: number;
  reactors: {
    member_id: string | null;
    member_name: string | null;
    member_avatar: string | null;
    reacted_at: string;
  }[];
}

interface MessageDetail {
  id: string;
  content: string | null;
  text: string | null;
  message_type: string;
  member_id: string | null;
  member_name: string;
  created_at: string;
  provider_message_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_caption: string | null;
  media_duration_sec: number | null;
  media_size_bytes: number | null;
  thumbnail_url: string | null;
}

const MESSAGE_TYPES = ['text', 'image', 'audio', 'video', 'document', 'sticker', 'location'];

// Format duration in seconds to mm:ss
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format file size in bytes to human readable
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Get icon for message type
const getMessageTypeIcon = (type: string) => {
  switch (type) {
    case 'image': return Image;
    case 'audio': return Mic;
    case 'video': return Video;
    case 'document': return FileText;
    case 'sticker': return Smile;
    case 'location': return MapPin;
    default: return MessageSquare;
  }
};

// Preview component for table cell
const MessageContentPreview = ({ message }: { message: MessageFeed }) => {
  switch (message.message_type) {
    case 'image':
      return (
        <div className="flex items-center gap-2">
          {message.media_url ? (
            <img 
              src={message.media_url} 
              alt="preview" 
              className="w-10 h-10 rounded object-cover bg-muted"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
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

    case 'sticker':
      return (
        <div className="flex items-center gap-2">
          {message.media_url ? (
            <img 
              src={message.media_url} 
              alt="sticker" 
              className="w-10 h-10 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center">
              <Smile className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <span className="text-muted-foreground text-sm">[Sticker]</span>
        </div>
      );

    case 'audio':
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <span className="text-muted-foreground text-sm">[Áudio]</span>
        </div>
      );

    case 'video':
      return (
        <div className="flex items-center gap-2">
          {message.thumbnail_url ? (
            <div className="relative">
              <img 
                src={message.thumbnail_url} 
                alt="video thumbnail" 
                className="w-10 h-10 rounded object-cover bg-muted"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                  <Video className="h-3 w-3 text-white" />
                </div>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
              <Video className="h-5 w-5 text-primary" />
            </div>
          )}
          <span className="text-muted-foreground text-sm">[Vídeo]</span>
        </div>
      );

    case 'document':
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-accent/20 flex items-center justify-center">
            <FileText className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="text-muted-foreground text-sm">[Documento]</span>
        </div>
      );

    case 'location':
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-success/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-success" />
          </div>
          <span className="text-muted-foreground text-sm">[Localização]</span>
        </div>
      );

    default:
      return (
        <span className="text-sm line-clamp-1 max-w-[200px]">
          {message.content_preview || `[${message.message_type}]`}
        </span>
      );
  }
};

// Detail view component for dialog
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

    default:
      return (
        <div className="p-3 rounded-lg bg-secondary/50 text-sm text-card-foreground whitespace-pre-wrap">
          {textContent || `[Mensagem do tipo ${message.message_type}]`}
        </div>
      );
  }
};

const GroupMessages = () => {
  const { groupId } = useParams();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const tabs = [
    { label: "Visão Geral", href: `/group/${groupId}`, end: true },
    { label: "Members", href: `/group/${groupId}/members`, icon: Users },
    { label: "Messages", href: `/group/${groupId}/messages`, icon: MessageSquare },
    { label: "Atividade", href: `/group/${groupId}/events`, icon: Activity },
  ];

  // Fetch group info for breadcrumbs
  const { data: groupInfo } = useQuery({
    queryKey: ['group-info', groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from('groups')
        .select('name, organization_id')
        .eq('id', groupId)
        .maybeSingle();
      
      if (!group) return null;

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', group.organization_id)
        .maybeSingle();

      return { groupName: group.name, orgName: org?.name, orgId: group.organization_id };
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Fetch messages from view
  const { data: messagesData, isLoading, error, refetch } = useQuery({
    queryKey: ['group-messages-feed', groupId, page, typeFilter],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // Try view first
      let query = supabase
        .from('v_messages_feed')
        .select('*', { count: 'exact' })
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      
      if (typeFilter) {
        query = query.eq('message_type', typeFilter);
      }
      
      const { data, error, count } = await query.range(from, to);
      
      if (error) {
        // Fallback to manual query if view doesn't exist
        console.warn('v_messages_feed not available, using fallback', error);
        
        let fallbackQuery = supabase
          .from('messages')
          .select('*', { count: 'exact' })
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });
        
        if (typeFilter) {
          fallbackQuery = fallbackQuery.eq('message_type', typeFilter);
        }
        
        const { data: msgData, error: msgError, count: msgCount } = await fallbackQuery.range(from, to);
        
        if (msgError) throw msgError;
        
        // Fetch member names for each message (fallback - not ideal but works)
        const items: MessageFeed[] = await Promise.all((msgData ?? []).map(async (m) => {
          let memberName = 'Unknown';
          if (m.member_id) {
            const { data: member } = await supabase
              .from('members')
              .select('name')
              .eq('id', m.member_id)
              .maybeSingle();
            if (member) memberName = member.name;
          }
          return {
            message_id: m.id,
            group_id: m.group_id,
            created_at: m.created_at,
            message_type: m.message_type,
            content_preview: m.content?.slice(0, 160) ?? null,
            member_id: m.member_id,
            member_name: memberName,
            provider_message_id: m.provider_message_id,
            media_url: m.media_url,
            media_mime_type: m.media_mime_type,
            thumbnail_url: m.thumbnail_url,
          };
        }));
        
        return { items, count: msgCount ?? 0 };
      }
      
      // Map view data to MessageFeed
      const items: MessageFeed[] = (data ?? []).map((d: any) => ({
        message_id: d.message_id,
        group_id: d.group_id,
        created_at: d.created_at,
        message_type: d.message_type,
        content_preview: d.content_preview,
        member_id: d.member_id,
        member_name: d.member_name || d.member_display_name || 'Unknown',
        provider_message_id: d.provider_message_id,
        media_url: d.media_url,
        media_mime_type: d.media_mime_type,
        thumbnail_url: d.thumbnail_url,
      }));
      
      return { items, count: count ?? 0 };
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Fetch reactions summary for all messages in the current page
  const { data: reactionsData } = useQuery({
    queryKey: ['message-reactions', groupId, messagesData?.items?.map(m => m.message_id)],
    queryFn: async () => {
      if (!messagesData?.items?.length) return {};
      
      const messageIds = messagesData.items.map(m => m.message_id);
      
      const { data, error } = await supabase
        .from('v_message_reactions_summary')
        .select('*')
        .in('message_id', messageIds);
      
      if (error) {
        console.warn('v_message_reactions_summary not available', error);
        return {};
      }

      // Group by message_id
      const grouped: Record<string, ReactionSummary[]> = {};
      for (const r of data || []) {
        if (!grouped[r.message_id]) {
          grouped[r.message_id] = [];
        }
        grouped[r.message_id].push({
          message_id: r.message_id,
          emoji: r.emoji,
          count: Number(r.count),
          reactors: (r.reactors as any[]) || [],
        });
      }
      return grouped;
    },
    enabled: !!groupId && isAuthenticated && !!messagesData?.items?.length,
  });

  // Memoized reactions map for quick lookup
  const reactionsMap = useMemo(() => reactionsData || {}, [reactionsData]);

  const handleViewDetail = async (m: MessageFeed) => {
    // Fetch full content for detail view
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('id', m.message_id)
      .maybeSingle();
    
    if (data) {
      setSelectedMessage({
        id: data.id,
        content: data.content,
        text: data.text,
        message_type: data.message_type,
        member_id: data.member_id,
        member_name: m.member_name,
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

  // Loading state
  if (authLoading) {
    return (
      <AdminLayout title="Messages" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  // Check access via error
  const errorCode = (error as any)?.code;
  if (error && (error.message?.includes('permission') || errorCode === 'PGRST301')) {
    return (
      <AccessDenied
        message="Você não tem permissão para acessar as mensagens deste grupo."
      />
    );
  }

  const columns = [
    { 
      key: 'created_at', 
      header: 'Data',
      render: (m: MessageFeed) => (
        <span className="text-xs">
          {new Date(m.created_at).toLocaleString('pt-BR')}
        </span>
      )
    },
    { 
      key: 'member_name', 
      header: 'Membro',
      render: (m: MessageFeed) => (
        <span className="text-sm font-medium">
          {m.member_name}
        </span>
      )
    },
    { 
      key: 'message_type', 
      header: 'Tipo',
      render: (m: MessageFeed) => {
        const Icon = getMessageTypeIcon(m.message_type);
        return (
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">
              {m.message_type}
            </span>
          </div>
        );
      }
    },
    { 
      key: 'content_preview', 
      header: 'Conteúdo',
      render: (m: MessageFeed) => (
        <div>
          <MessageContentPreview message={m} />
          <ReactionBadges 
            reactions={(reactionsMap[m.message_id] || []).map(r => ({ emoji: r.emoji, count: r.count }))} 
          />
        </div>
      )
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (m: MessageFeed) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleViewDetail(m);
          }}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <Eye className="h-4 w-4 text-muted-foreground" />
        </button>
      )
    },
  ];

  return (
    <AdminLayout 
      title="Messages" 
      subtitle={`Mensagens do grupo`}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "System", href: "/system" },
            { label: groupInfo?.orgName || "Org", href: `/org/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/group/${groupId}` },
            { label: "Messages" },
          ]}
        />

        {/* Header with tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-card-foreground">Messages</h2>
              <p className="text-sm text-muted-foreground">
                {messagesData?.count ?? 0} mensagens neste grupo
              </p>
            </div>
          </div>
          
          <div className="flex gap-1 p-2 bg-secondary/30">
            {tabs.map((tab) => (
              <NavLink
                key={tab.href}
                to={tab.href}
                end={tab.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-card text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tipo:</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => {
                setTypeFilter("");
                setPage(1);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                !typeFilter 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              Todos
            </button>
            {MESSAGE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setTypeFilter(type);
                  setPage(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                  typeFilter === type 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <LoadingState message="Carregando mensagens..." />
        ) : error ? (
          <ErrorState 
            message="Falha ao carregar mensagens"
            retry={() => refetch()}
          />
        ) : messagesData?.items.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={typeFilter ? "Nenhum resultado" : "Nenhuma mensagem"}
            message={typeFilter ? `Nenhuma mensagem do tipo "${typeFilter}" encontrada.` : "Este grupo ainda não possui mensagens."}
          />
        ) : (
          <DataTable
            columns={columns}
            data={messagesData?.items ?? []}
            keyExtractor={(m) => m.message_id}
            onRowClick={(m) => handleViewDetail(m)}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={messagesData?.count}
            onPageChange={setPage}
          />
        )}

        {/* Message detail dialog */}
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
                      {(() => {
                        const Icon = getMessageTypeIcon(selectedMessage.message_type);
                        return <Icon className="h-4 w-4 text-muted-foreground" />;
                      })()}
                      <span className="font-medium text-card-foreground capitalize">
                        {selectedMessage.message_type}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data</span>
                    <p className="font-medium text-card-foreground mt-1">
                      {new Date(selectedMessage.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Membro</span>
                    <p className="font-medium text-card-foreground mt-1">
                      {selectedMessage.member_name}
                    </p>
                  </div>
                  {selectedMessage.provider_message_id && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Provider Message ID</span>
                      <p className="font-medium text-card-foreground font-mono text-xs mt-1">
                        {selectedMessage.provider_message_id}
                      </p>
                    </div>
                  )}
                </div>
                
                <div>
                  <span className="text-sm text-muted-foreground">Conteúdo</span>
                  <div className="mt-2">
                    <MessageDetailView message={selectedMessage} />
                  </div>
                </div>
                
                {/* Reactions section */}
                <ReactionDetails 
                  reactions={reactionsMap[selectedMessage.id] || []}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default GroupMessages;
