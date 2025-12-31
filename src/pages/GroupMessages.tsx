import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { 
  MessageSquare, Filter, Eye, Activity,
  Image, Mic, Video, FileText, MapPin, Smile, Search, X 
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { ReactionBadges } from "@/components/messages/ReactionBadges";
import { MessageDetailsDrawer } from "@/components/messages/MessageDetailsDrawer";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { ImportMessagesModal } from "@/components/modals/ImportMessagesModal";
 
 

const PAGE_SIZE = 10;

interface MessageFeed {
  message_id: string;
  group_id: string;
  created_at: string;
  message_type: string;
  content_preview: string | null;
  member_id: string | null;
  member_name: string;
  member_avatar: string | null;
  whatsapp_provider_id: string | null;
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


const MESSAGE_TYPES = ['text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'poll', 'poll_vote'];

// Translate message type to Portuguese
const translateMessageType = (type: string): string => {
  const translations: Record<string, string> = {
    'text': 'Texto',
    'image': 'Imagem',
    'audio': 'Áudio',
    'video': 'Vídeo',
    'document': 'Documento',
    'sticker': 'Figurinha',
    'location': 'Localização',
    'poll': 'Enquete',
    'poll_vote': 'Voto em enquete',
  };
  return translations[type] || type;
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
    case 'poll': return Activity;
    case 'poll_vote': return Activity;
    default: return MessageSquare;
  }
};

const PollInlineSummary = ({ groupId, providerMessageId }: { groupId: string; providerMessageId: string | null }) => {
  const { data: poll } = useQuery({
    queryKey: ['poll-inline', groupId, providerMessageId],
    queryFn: async () => {
      if (!providerMessageId) return null;
      const { data } = await (supabase as any)
        .from('polls')
        .select('id')
        .eq('group_id', groupId)
        .eq('whatsapp_provider_id', providerMessageId)
        .maybeSingle();
      return data;
    },
    enabled: !!groupId && !!providerMessageId,
  });

  const { data: summary } = useQuery({
    queryKey: ['poll-inline-summary', poll?.id],
    queryFn: async () => {
      if (!poll?.id) return null;
      const { data } = await (supabase as any)
        .from('v_poll_summary')
        .select('voters_count')
        .eq('poll_id', poll.id)
        .maybeSingle();
      return data;
    },
    enabled: !!poll?.id,
  });

  const { data: results } = useQuery({
    queryKey: ['poll-inline-results', poll?.id],
    queryFn: async () => {
      if (!poll?.id) return [];
      const { data } = await (supabase as any)
        .from('v_poll_results')
        .select('option_text, option_index, votes_count')
        .eq('poll_id', poll.id)
        .order('option_index', { ascending: true });
      return (data ?? []).slice(0, 3).map((r: { option_text: string; option_index: number; votes_count: number | null }) => ({
        optionText: r.option_text as string,
        optionIndex: Number(r.option_index),
        votesCount: Number(r.votes_count ?? 0),
      }));
    },
    enabled: !!poll?.id,
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground">{summary?.voters_count ? `${summary.voters_count} voto(s)` : 'Sem votos'}</span>
      {(results ?? []).map((r: { optionText: string; optionIndex: number; votesCount: number }) => (
        <span key={r.optionIndex} className="text-[11px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
          {r.optionText} {r.votesCount}
        </span>
      ))}
    </div>
  );
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

    case 'poll':
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm line-clamp-1 max-w-[200px]">
              {message.content_preview || '[Enquete]'}
            </span>
          </div>
          <PollInlineSummary groupId={message.group_id!} providerMessageId={message.whatsapp_provider_id || null} />
        </div>
      );

    case 'poll_vote':
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-secondary/50 flex items-center justify-center">
            <Activity className="h-5 w-5 text-secondary-foreground" />
          </div>
          <span className="text-muted-foreground text-sm">
            {message.content_preview || '[Voto em enquete]'}
          </span>
        </div>
      );

    default:
      return (
        <span className="text-sm line-clamp-1 max-w-[200px]">
          {message.content_preview || `[${translateMessageType(message.message_type)}]`}
        </span>
      );
  }
};

 

// Detail view is handled by MessageDetailModal

const GroupMessages = () => {
  const { groupId } = useParams();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { canEditGroup, isLoading: rolesLoading } = useUserRoles();
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const querySearch = searchParams.get("q") || "";
  const [search, setSearch] = useState(querySearch);

  useEffect(() => {
    setSearch(querySearch);
    setPage(1);
  }, [querySearch]);

  const safeSearch = useMemo(() => search.trim().replace(/,/g, " "), [search]);


  // Fetch group info for breadcrumbs
  const { data: groupInfo } = useQuery({
    queryKey: ['group-info', groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from('groups')
        .select('name, organization_id, provider, sync_status')
        .eq('id', groupId)
        .maybeSingle();
      if (!group) return null;
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', group.organization_id)
        .maybeSingle();
      return { groupName: group.name, orgName: org?.name, orgId: group.organization_id, provider: group.provider, syncStatus: group.sync_status };
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: totalMembersCount } = useQuery({
    queryKey: ['group-members-total', groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .is('deleted_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: lastMessageAt } = useQuery({
    queryKey: ['group-last-message', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const first = (data ?? [])[0] as { created_at: string } | undefined;
      return first?.created_at ?? null;
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Fetch messages from view
  const { data: messagesData, isLoading, error, refetch } = useQuery({
    queryKey: ['group-messages-feed', groupId, page, typeFilter, safeSearch],
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

      if (safeSearch) {
        query = query.ilike('content_preview', `%${safeSearch}%`);
      }
      
      const { data, error, count } = await query.range(from, to);
      
      if (error) {
        // Fallback to manual query if view doesn't exist
        
        let fallbackQuery = supabase
          .from('messages')
          .select('*', { count: 'exact' })
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });
        
        if (typeFilter) {
          fallbackQuery = fallbackQuery.eq('message_type', typeFilter);
        }

        if (safeSearch) {
          fallbackQuery = fallbackQuery.or(`content.ilike.%${safeSearch}%,text.ilike.%${safeSearch}%,sender_name.ilike.%${safeSearch}%`);
        }
        
      const { data: msgData, error: msgError, count: msgCount } = await fallbackQuery.range(from, to);
        
        if (msgError) throw msgError;
        
        // Fetch member names for each message (fallback - not ideal but works)
        const items: MessageFeed[] = await Promise.all((msgData ?? []).map(async (m) => {
          let memberName = 'Unknown';
          let memberAvatar: string | null = null;
          if (m.member_id) {
            const { data: member } = await supabase
              .from('members')
              .select('name, profile_pic_url')
              .eq('id', m.member_id)
              .maybeSingle();
            if (member) {
              memberName = member.name;
              memberAvatar = (member as any).profile_pic_url || null;
            }
          }
          return {
            message_id: m.id,
            group_id: m.group_id,
            created_at: m.created_at,
            message_type: m.message_type,
            content_preview: m.content?.slice(0, 160) ?? null,
            member_id: m.member_id,
            member_name: memberName,
            member_avatar: memberAvatar,
            whatsapp_provider_id: m.whatsapp_provider_id,
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
        member_avatar: d.member_avatar || null,
        whatsapp_provider_id: d.whatsapp_provider_id,
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
    if (m.message_type === 'poll') {
      const { data: poll } = await (supabase as any)
        .from('polls')
        .select('id')
        .eq('group_id', groupId)
        .eq('whatsapp_provider_id', m.whatsapp_provider_id)
        .maybeSingle();

      if (poll?.id) {
        navigate(`/groups/${groupId}/polls/${poll.id}`);
        return;
      }
    }
    setSelectedMessageId(m.message_id);
  };

  // Loading state
  if (authLoading || rolesLoading) {
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
        m.member_id ? (
          <MemberInlineTrigger memberId={m.member_id} groupId={groupId} name={m.member_name} avatarUrl={m.member_avatar} />
        ) : (
          <span className="text-sm text-muted-foreground">Sistema</span>
        )
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
            <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
              {translateMessageType(m.message_type)}
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
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Eye className="h-4 w-4 text-muted-foreground" />
        </button>
      )
    },
  ];

  return (
    <AdminLayout 
      title="Mensagens" 
      subtitle={`${messagesData?.count ?? 0} mensagens`}
    >
      <div className="space-y-6 animate-fade-in">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Mensagens" },
          ]}
          group={{
            groupId: groupId as string,
            name: groupInfo?.groupName || "",
            provider: groupInfo?.provider || "",
            totalMembers: (totalMembersCount ?? 0) as number,
            lastMessageAt: lastMessageAt ?? null,
            syncStatus: groupInfo?.syncStatus || null,
          }}
          activeTab="mensagens"
          filters={(
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por conteúdo..."
                  value={search}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSearch(next);
                    setPage(1);
                    const sp = new URLSearchParams(searchParams);
                    const trimmed = next.trim();
                    if (trimmed) sp.set('q', trimmed);
                    else sp.delete('q');
                    setSearchParams(sp, { replace: true });
                  }}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                {search ? (
                  <button
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                      const sp = new URLSearchParams(searchParams);
                      sp.delete('q');
                      setSearchParams(sp, { replace: true });
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Limpar busca"
                    type="button"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                ) : null}
              </div>

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
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      typeFilter === type 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {translateMessageType(type)}
                  </button>
                ))}
              </div>
            </div>
          )}
          showClearFilters={!!typeFilter || !!search.trim()}
          onClearFilters={() => {
            setTypeFilter("");
            setPage(1);
            setSearch('');
            const sp = new URLSearchParams(searchParams);
            sp.delete('q');
            setSearchParams(sp, { replace: true });
          }}
          rightActions={canEditGroup(groupId as string, groupInfo?.orgId) ? (
            <Button onClick={() => setImportOpen(true)} variant="secondary">
              <Upload className="h-4 w-4 mr-2" />
              Importar mensagens
            </Button>
          ) : null}
        />

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
            title={typeFilter || search.trim() ? "Nenhum resultado" : "Nenhuma mensagem"}
            message={
              typeFilter || search.trim()
                ? `Nenhuma mensagem${typeFilter ? ` do tipo "${typeFilter}"` : ""}${search.trim() ? ` contendo "${search.trim()}"` : ""} encontrada.`
                : "Este grupo ainda não possui mensagens."
            }
          />
        ) : (
          <BorisTable
            columns={columns as any}
            data={messagesData?.items ?? []}
            keyExtractor={(m) => m.message_id}
            onRowClick={(m) => handleViewDetail(m)}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={messagesData?.count}
            onPageChange={setPage}
          />
        )}

        <MessageDetailsDrawer 
          open={!!selectedMessageId}
          onOpenChange={(open) => {
            if (!open) setSelectedMessageId(null);
          }}
          groupId={groupId as string}
          messageId={selectedMessageId as string}
          variant="sheet"
        />

        <ImportMessagesModal
          groupId={groupId as string}
          open={importOpen}
          onOpenChange={(o) => {
            setImportOpen(o);
            if (!o) {
              queryClient.invalidateQueries({ queryKey: ["group-messages-feed", groupId], exact: false });
              queryClient.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("group-dashboard"),
              });
            }
          }}
        />
      </div>
    </AdminLayout>
  );
};

export default GroupMessages;
