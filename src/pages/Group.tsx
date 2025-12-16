import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import { Users, MessageSquare, Clock, Edit, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { EditGroupModal } from "@/components/modals/EditGroupModal";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface GroupOverview {
  group_id: string;
  group_name: string;
  organization_id: string;
  provider: string;
  provider_group_id: string | null;
  members_count: number;
  messages_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_member_name: string | null;
}

const Group = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { canEditGroup, isLoading: rolesLoading } = useUserRoles();
  const [editOpen, setEditOpen] = useState(false);

  // Fetch group overview from view
  const { data: overview, isLoading, error, refetch } = useQuery({
    queryKey: ['group-overview', groupId],
    queryFn: async () => {
      // Try view first
      const { data, error } = await supabase
        .from('v_group_overview')
        .select('*')
        .eq('group_id', groupId)
        .maybeSingle();
      
      if (error) {
        // Fallback to manual queries if view doesn't exist
        console.warn('v_group_overview not available, using fallback', error);
        
        const [groupRes, membersCountRes, messagesCountRes, lastMessageRes] = await Promise.all([
          supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
          supabase.from('members').select('*', { count: 'exact', head: true }).eq('group_id', groupId),
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('group_id', groupId),
          supabase.from('messages').select('id, content, message_type, created_at, member_id').eq('group_id', groupId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        
        if (groupRes.error) throw groupRes.error;
        if (!groupRes.data) return null;
        
        let lastMemberName = 'Unknown';
        if (lastMessageRes.data?.member_id) {
          const { data: memberData } = await supabase
            .from('members')
            .select('name')
            .eq('id', lastMessageRes.data.member_id)
            .maybeSingle();
          if (memberData) lastMemberName = memberData.name;
        }
        
        return {
          group_id: groupRes.data.id,
          group_name: groupRes.data.name,
          organization_id: groupRes.data.organization_id,
          provider: groupRes.data.provider,
          provider_group_id: groupRes.data.provider_group_id,
          members_count: membersCountRes.count ?? 0,
          messages_count: messagesCountRes.count ?? 0,
          last_message_at: lastMessageRes.data?.created_at ?? null,
          last_message_preview: lastMessageRes.data?.content?.slice(0, 100) ?? null,
          last_message_member_name: lastMemberName,
        } as GroupOverview;
      }
      
      return data as GroupOverview;
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Fetch org name for breadcrumb
  const { data: orgData } = useQuery({
    queryKey: ['org-name', overview?.organization_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', overview!.organization_id)
        .maybeSingle();
      return data;
    },
    enabled: !!overview?.organization_id,
  });

  const tabs = [
    { label: "Visão Geral", href: `/group/${groupId}`, end: true },
    { label: "Members", href: `/group/${groupId}/members`, icon: Users },
    { label: "Messages", href: `/group/${groupId}/messages`, icon: MessageSquare },
    { label: "Atividade", href: `/group/${groupId}/events`, icon: Activity },
  ];

  // Loading state while checking auth/roles
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Grupo" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (isLoading) {
    return (
      <AdminLayout title="Grupo" subtitle="Carregando...">
        <LoadingState message="Carregando detalhes do grupo..." />
      </AdminLayout>
    );
  }

  // Check access - RLS will return null if no access
  if (error || !overview) {
    const errorCode = (error as any)?.code;
    if (error?.message?.includes('permission') || errorCode === 'PGRST301') {
      return (
        <AccessDenied
          message="Você não tem permissão para acessar este grupo."
        />
      );
    }
    return (
      <AdminLayout title="Grupo" subtitle="Erro">
        <ErrorState 
          title="Grupo não encontrado"
          message="Não foi possível carregar os detalhes deste grupo. Você pode não ter acesso."
          retry={() => navigate('/system')}
        />
      </AdminLayout>
    );
  }

  const userCanEdit = canEditGroup(groupId!, overview.organization_id);

  const groupForEdit = {
    id: overview.group_id,
    name: overview.group_name,
    organization_id: overview.organization_id,
    provider: overview.provider,
    provider_group_id: overview.provider_group_id,
  };

  return (
    <AdminLayout 
      title="Grupo" 
      subtitle={overview.group_name}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "System", href: "/system" },
            { label: orgData?.name || "Org", href: `/org/${overview.organization_id}` },
            { label: overview.group_name },
          ]}
        />

        {/* Group header with tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-card-foreground">{overview.group_name}</h2>
              <p className="text-sm text-muted-foreground">
                Provider: {overview.provider} {overview.provider_group_id && `• ID: ${overview.provider_group_id}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                Ativo
              </span>
              {userCanEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
            </div>
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
            <p className="text-2xl font-bold text-card-foreground">{overview.members_count}</p>
          </button>

          <button
            onClick={() => navigate(`/group/${groupId}/messages`)}
            className="rounded-xl border border-border bg-card p-5 hover:bg-secondary/30 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total de Messages</span>
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-card-foreground">{overview.messages_count}</p>
          </button>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Última Mensagem</span>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            {overview.last_message_at ? (
              <div>
                <p className="text-sm text-card-foreground line-clamp-1">
                  {overview.last_message_preview || '[Mídia]'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {overview.last_message_member_name} • {new Date(overview.last_message_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
            )}
          </div>
        </div>
      </div>

      {/* Edit group modal */}
      <EditGroupModal
        group={groupForEdit}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => refetch()}
      />
    </AdminLayout>
  );
};

export default Group;
