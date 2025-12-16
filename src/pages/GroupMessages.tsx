import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams, NavLink } from "react-router-dom";
import { Users, MessageSquare, Filter, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
}

interface MessageDetail {
  id: string;
  content: string | null;
  message_type: string;
  member_id: string | null;
  member_name: string;
  created_at: string;
  provider_message_id: string | null;
}

const MESSAGE_TYPES = ['text', 'image', 'audio', 'video', 'document', 'sticker', 'location'];

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
          };
        }));
        
        return { items, count: msgCount ?? 0 };
      }
      
      return { 
        items: (data ?? []) as MessageFeed[], 
        count: count ?? 0 
      };
    },
    enabled: !!groupId && isAuthenticated,
  });

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
        message_type: data.message_type,
        member_id: data.member_id,
        member_name: m.member_name,
        created_at: data.created_at,
        provider_message_id: data.provider_message_id,
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
      render: (m: MessageFeed) => (
        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">
          {m.message_type}
        </span>
      )
    },
    { 
      key: 'content_preview', 
      header: 'Conteúdo',
      render: (m: MessageFeed) => (
        <span className="text-sm line-clamp-1 max-w-[200px]">
          {m.content_preview || `[${m.message_type}]`}
        </span>
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
                    <p className="font-medium text-card-foreground capitalize">{selectedMessage.message_type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data</span>
                    <p className="font-medium text-card-foreground">
                      {new Date(selectedMessage.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Membro</span>
                    <p className="font-medium text-card-foreground">
                      {selectedMessage.member_name}
                    </p>
                  </div>
                  {selectedMessage.provider_message_id && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Provider Message ID</span>
                      <p className="font-medium text-card-foreground font-mono text-xs">
                        {selectedMessage.provider_message_id}
                      </p>
                    </div>
                  )}
                </div>
                
                <div>
                  <span className="text-sm text-muted-foreground">Conteúdo</span>
                  <div className="mt-2 p-3 rounded-lg bg-secondary/50 text-sm text-card-foreground whitespace-pre-wrap">
                    {selectedMessage.content || `[Mensagem do tipo ${selectedMessage.message_type}]`}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default GroupMessages;
