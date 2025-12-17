import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import { Users, MessageSquare, Clock, Edit, Activity, ChevronDown, RefreshCw, Link2, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { EditGroupModal } from "@/components/modals/EditGroupModal";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  provider: string;
  provider_group_id: string | null;
  provider_phone: string | null;
  invite_link: string | null;
  invite_link_status: string;
  is_active: boolean;
  is_archived: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  created_at_provider: string | null;
  last_sync_at: string | null;
  sync_status: string;
  sync_error: string | null;
  counts_cache: Record<string, any> | null;
  deleted_at: string | null;
  metadata: Record<string, any> | null;
  raw_provider: Record<string, any> | null;
}

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

  // Fetch full group details
  const { data: groupDetail, isLoading, error, refetch } = useQuery({
    queryKey: ['group-detail', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();
      
      if (error) throw error;
      return data as GroupDetail;
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Fetch overview stats
  const { data: overview } = useQuery({
    queryKey: ['group-overview', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_group_overview')
        .select('*')
        .eq('group_id', groupId)
        .maybeSingle();
      
      if (error) {
        // Fallback to manual counts
        const [membersCountRes, messagesCountRes] = await Promise.all([
          supabase.from('members').select('*', { count: 'exact', head: true }).eq('group_id', groupId).is('deleted_at', null),
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('group_id', groupId).is('deleted_at', null),
        ]);
        
        return {
          members_count: membersCountRes.count ?? 0,
          messages_count: messagesCountRes.count ?? 0,
          last_message_at: null,
          last_message_preview: null,
          last_message_member_name: null,
        } as Partial<GroupOverview>;
      }
      
      return data as GroupOverview;
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Fetch org name for breadcrumb
  const { data: orgData } = useQuery({
    queryKey: ['org-name', groupDetail?.organization_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', groupDetail!.organization_id)
        .maybeSingle();
      return data;
    },
    enabled: !!groupDetail?.organization_id,
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
  if (error || !groupDetail) {
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

  const userCanEdit = canEditGroup(groupId!, groupDetail.organization_id);

  return (
    <AdminLayout 
      title="Grupo" 
      subtitle={groupDetail.name}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "System", href: "/system" },
            { label: orgData?.name || "Org", href: `/org/${groupDetail.organization_id}` },
            { label: groupDetail.name },
          ]}
        />

        {/* Group header with tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-card-foreground">{groupDetail.name}</h2>
              {groupDetail.description && (
                <p className="text-sm text-muted-foreground">{groupDetail.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                groupDetail.is_archived ? 'bg-muted text-muted-foreground' :
                groupDetail.is_active ? 'bg-success/10 text-success' : 
                'bg-destructive/10 text-destructive'
              }`}>
                {groupDetail.is_archived ? 'Arquivado' : groupDetail.is_active ? 'Ativo' : 'Inativo'}
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
            <p className="text-2xl font-bold text-card-foreground">{overview?.members_count ?? 0}</p>
          </button>

          <button
            onClick={() => navigate(`/group/${groupId}/messages`)}
            className="rounded-xl border border-border bg-card p-5 hover:bg-secondary/30 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total de Messages</span>
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-card-foreground">{overview?.messages_count ?? 0}</p>
          </button>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Última Mensagem</span>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            {overview?.last_message_at ? (
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

        {/* Detail Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section: Geral */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Geral</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Nome</span>
                <p className="font-medium text-card-foreground">{groupDetail.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="font-medium text-card-foreground capitalize">{groupDetail.status}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Descrição</span>
                <p className="font-medium text-card-foreground">{groupDetail.description || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Ativo</span>
                <p className="font-medium text-card-foreground">{groupDetail.is_active ? 'Sim' : 'Não'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Arquivado</span>
                <p className="font-medium text-card-foreground">{groupDetail.is_archived ? 'Sim' : 'Não'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Criado em</span>
                <p className="font-medium text-card-foreground">
                  {new Date(groupDetail.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Atualizado em</span>
                <p className="font-medium text-card-foreground">
                  {new Date(groupDetail.updated_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Provedor */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Provedor
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Provider</span>
                <p className="font-medium text-card-foreground capitalize">{groupDetail.provider}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Provider Group ID</span>
                <p className="font-medium text-card-foreground font-mono text-xs break-all">
                  {groupDetail.provider_group_id || '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Provider Phone</span>
                <p className="font-medium text-card-foreground">{groupDetail.provider_phone || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Criado no Provider</span>
                <p className="font-medium text-card-foreground">
                  {groupDetail.created_at_provider 
                    ? new Date(groupDetail.created_at_provider).toLocaleString('pt-BR') 
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Link de Convite */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Link de Convite
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Status do Link</span>
                <p className={`font-medium ${
                  groupDetail.invite_link_status === 'valid' ? 'text-success' :
                  groupDetail.invite_link_status === 'invalid' ? 'text-destructive' :
                  'text-muted-foreground'
                }`}>
                  {groupDetail.invite_link_status}
                </p>
              </div>
              {groupDetail.invite_link && (
                <div>
                  <span className="text-muted-foreground">Link</span>
                  <p className="font-medium text-card-foreground font-mono text-xs break-all">
                    {groupDetail.invite_link}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section: Sincronização */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Sincronização
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className={`font-medium ${
                  groupDetail.sync_status === 'synced' ? 'text-success' :
                  groupDetail.sync_status === 'error' ? 'text-destructive' :
                  groupDetail.sync_status === 'syncing' ? 'text-accent' :
                  'text-muted-foreground'
                }`}>
                  {groupDetail.sync_status}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Última Sync</span>
                <p className="font-medium text-card-foreground">
                  {groupDetail.last_sync_at 
                    ? new Date(groupDetail.last_sync_at).toLocaleString('pt-BR') 
                    : '-'}
                </p>
              </div>
              {groupDetail.sync_error && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Erro</span>
                  <p className="font-medium text-destructive text-xs">{groupDetail.sync_error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible sections for JSON data */}
        <div className="space-y-4">
          {/* Counts Cache */}
          {groupDetail.counts_cache && Object.keys(groupDetail.counts_cache).length > 0 && (
            <Collapsible className="rounded-xl border border-border bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-secondary/30 transition-colors">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Counts Cache</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                  {JSON.stringify(groupDetail.counts_cache, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Metadata */}
          {groupDetail.metadata && Object.keys(groupDetail.metadata).length > 0 && (
            <Collapsible className="rounded-xl border border-border bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-secondary/30 transition-colors">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Metadados</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                  {JSON.stringify(groupDetail.metadata, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Raw Provider */}
          {groupDetail.raw_provider && Object.keys(groupDetail.raw_provider).length > 0 && (
            <Collapsible className="rounded-xl border border-border bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-secondary/30 transition-colors">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Raw Provider</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                  {JSON.stringify(groupDetail.raw_provider, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Edit group modal */}
      <EditGroupModal
        group={groupDetail}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => refetch()}
      />
    </AdminLayout>
  );
};

export default Group;