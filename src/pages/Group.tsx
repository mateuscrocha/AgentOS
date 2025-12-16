import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import { Users, MessageSquare, ArrowLeft, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const Group = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();

  // Fetch group details
  const { data: group, isLoading: groupLoading, error: groupError } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  // Fetch members count
  const { data: membersCount } = useQuery({
    queryKey: ['group-members-count', groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);
      
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId,
  });

  // Fetch messages count
  const { data: messagesCount } = useQuery({
    queryKey: ['group-messages-count', groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);
      
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId,
  });

  // Fetch last message
  const { data: lastMessage } = useQuery({
    queryKey: ['group-last-message', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, message_type, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const tabs = [
    { label: "Visão Geral", href: `/group/${groupId}`, end: true },
    { label: "Members", href: `/group/${groupId}/members`, icon: Users },
    { label: "Messages", href: `/group/${groupId}/messages`, icon: MessageSquare },
  ];

  if (groupLoading) {
    return (
      <AdminLayout title="Grupo" subtitle="Carregando...">
        <LoadingState message="Carregando detalhes do grupo..." />
      </AdminLayout>
    );
  }

  if (groupError || !group) {
    return (
      <AdminLayout title="Grupo" subtitle="Erro">
        <ErrorState 
          title="Grupo não encontrado"
          message="Não foi possível carregar os detalhes deste grupo."
          retry={() => navigate('/system')}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Grupo" 
      subtitle={group.name}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Back button */}
        <button
          onClick={() => navigate(`/org/${group.organization_id}`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Organização
        </button>

        {/* Group header with tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-card-foreground">{group.name}</h2>
              <p className="text-sm text-muted-foreground">
                Provider: {group.provider} {group.provider_group_id && `• ID: ${group.provider_group_id}`}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
              Ativo
            </span>
          </div>
          
          {/* Tab navigation */}
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
        
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate(`/group/${groupId}/members`)}
            className="rounded-xl border border-border bg-card p-5 hover:bg-secondary/30 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total de Members</span>
              <Users className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-card-foreground">{membersCount ?? 0}</p>
          </button>

          <button
            onClick={() => navigate(`/group/${groupId}/messages`)}
            className="rounded-xl border border-border bg-card p-5 hover:bg-secondary/30 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total de Messages</span>
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-card-foreground">{messagesCount ?? 0}</p>
          </button>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Última Mensagem</span>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            {lastMessage ? (
              <div>
                <p className="text-sm text-card-foreground line-clamp-1">
                  {lastMessage.content || `[${lastMessage.message_type}]`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(lastMessage.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Group;
