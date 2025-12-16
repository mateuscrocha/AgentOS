import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useParams, NavLink } from "react-router-dom";
import { Users, MessageSquare, Filter, Eye, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 10;

interface Message {
  id: string;
  content: string | null;
  message_type: string;
  member_id: string | null;
  created_at: string;
  provider_message_id: string | null;
}

const MESSAGE_TYPES = ['text', 'image', 'audio', 'video', 'document', 'sticker', 'location'];

const GroupMessages = () => {
  const { groupId } = useParams();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const tabs = [
    { label: "Visão Geral", href: `/group/${groupId}`, end: true },
    { label: "Members", href: `/group/${groupId}/members`, icon: Users },
    { label: "Messages", href: `/group/${groupId}/messages`, icon: MessageSquare },
  ];

  // Fetch messages
  const { data: messagesData, isLoading, error, refetch } = useQuery({
    queryKey: ['group-messages', groupId, page, typeFilter],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      
      if (typeFilter) {
        query = query.eq('message_type', typeFilter);
      }
      
      const { data, error, count } = await query.range(from, to);
      
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
    },
    enabled: !!groupId,
  });

  const columns = [
    { 
      key: 'created_at', 
      header: 'Data',
      render: (m: Message) => (
        <span className="text-xs">
          {new Date(m.created_at).toLocaleString('pt-BR')}
        </span>
      )
    },
    { 
      key: 'message_type', 
      header: 'Tipo',
      render: (m: Message) => (
        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">
          {m.message_type}
        </span>
      )
    },
    { 
      key: 'member_id', 
      header: 'Member ID',
      render: (m: Message) => (
        <span className="text-xs font-mono text-muted-foreground">
          {m.member_id ? m.member_id.slice(0, 8) + '...' : '-'}
        </span>
      )
    },
    { 
      key: 'content', 
      header: 'Conteúdo',
      render: (m: Message) => (
        <span className="text-sm line-clamp-1 max-w-[200px]">
          {m.content || `[${m.message_type}]`}
        </span>
      )
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (m: Message) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedMessage(m);
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
            keyExtractor={(m) => m.id}
            onRowClick={(m) => setSelectedMessage(m)}
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
                  {selectedMessage.member_id && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Member ID</span>
                      <p className="font-medium text-card-foreground font-mono text-xs">
                        {selectedMessage.member_id}
                      </p>
                    </div>
                  )}
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
