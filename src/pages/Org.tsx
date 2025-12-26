import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Building2, Users, Edit, ChevronDown, CreditCard, Mail, Plus, Trash2, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";
import { EditOrganizationContactModal } from "@/components/modals/EditOrganizationContactModal";
import { EditGroupModal } from "@/components/modals/EditGroupModal";
import { AddGroupModal } from "@/components/modals/AddGroupModal";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/group-dashboard/KpiCard";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 10;

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  owner_user_id: string | null;
  plan: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  billing_status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  settings: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, any> | null;
}

interface GroupItem {
  id: string;
  name: string;
  provider: string;
  created_at: string;
  organization_id: string;
  provider_group_id: string | null;
  is_active: boolean | null;
  sync_status: string | null;
}

const Org = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { canEditOrg, canEditGroup, isLoading: rolesLoading, isSystemAdmin } = useUserRoles();
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupItem | null>(null);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [removeGroup, setRemoveGroup] = useState<GroupItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);

  // Fetch organization details
  const { data: org, isLoading: orgLoading, error: orgError, refetch: refetchOrg } = useQuery({
    queryKey: ['organization-detail', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();
      
      if (error) throw error;
      return data as OrganizationDetail;
    },
    enabled: !!orgId && isAuthenticated,
  });

  // Fetch owner profile if exists
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', org?.owner_user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', org!.owner_user_id!)
        .maybeSingle();
      return data;
    },
    enabled: !!org?.owner_user_id,
  });

  const { data: primaryContact, isLoading: contactLoading, error: contactError, refetch: refetchPrimaryContact } = useQuery({
    queryKey: ['org-primary-contact', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_contacts')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_primary', true)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        organization_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        role_title: string | null;
        is_primary: boolean;
        created_at: string;
        updated_at: string;
      };
    },
    enabled: !!orgId && isAuthenticated,
  });

  const contactName = primaryContact?.name || org?.contact_name || undefined;
  const contactEmail = primaryContact?.email || org?.contact_email || undefined;
  const contactPhone = primaryContact?.phone || org?.contact_phone || undefined;
  const contactRole = primaryContact?.role_title || undefined;

  const { data: orgGroupIds } = useQuery({
    queryKey: ['org-group-ids', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('groups')
        .select('id')
        .eq('organization_id', orgId!)
        .is('deleted_at', null)
        .neq('is_archived', true);
      return (data ?? []).map((g: { id: string }) => g.id);
    },
    enabled: !!orgId && isAuthenticated,
  });

  const { data: totalMembersCount, isLoading: membersCountLoading } = useQuery({
    queryKey: ['org-total-members', orgId, orgGroupIds?.join(',')],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return 0;
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .in('group_id', orgGroupIds)
        .is('deleted_at', null);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated && Array.isArray(orgGroupIds),
  });

  const { data: messagesLast7dCount, isLoading: messagesCountLoading } = useQuery({
    queryKey: ['org-messages-7d', orgId, orgGroupIds?.join(',')],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return 0;
      const fromISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const toISO = new Date().toISOString();
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('group_id', orgGroupIds)
        .is('deleted_at', null)
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated && Array.isArray(orgGroupIds),
  });

  const { data: activeGroupsCount, isLoading: activeGroupsLoading } = useQuery({
    queryKey: ['org-active-groups-count', orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId!)
        .is('deleted_at', null)
        .neq('is_archived', true)
        .eq('is_active', true);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated,
  });

  const [membersPage, setMembersPage] = useState(1);
  const [membersSearch, setMembersSearch] = useState("");

  const { data: orgMembersData, isLoading: orgMembersLoading, error: orgMembersError, refetch: refetchOrgMembers } = useQuery({
    queryKey: ['org-members', orgId, membersPage, membersSearch, orgGroupIds?.join(',')],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return { items: [], count: 0 };
      const from = (membersPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('members')
        .select('*, groups(name)', { count: 'exact' })
        .in('group_id', orgGroupIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (membersSearch) {
        query = query.or(`name.ilike.%${membersSearch}%,phone_e164.ilike.%${membersSearch}%,display_name.ilike.%${membersSearch}%`);
      }
      const { data, count, error } = await query.range(from, to);
      if (error) throw error;
      return { items: (data ?? []) as any[], count: count ?? 0 };
    },
    enabled: !!orgId && isAuthenticated && Array.isArray(orgGroupIds),
  });

  const path = location.pathname;
  const isMembersRoute = /\/organization\/.+\/members$/.test(path);
  const isGroupsRoute = /\/organization\/.+\/groups$/.test(path);
  const isSettingsRoute = /\/organization\/.+\/settings$/.test(path);
  const isDashboardRoute = /\/organization\/.+\/dashboard$/.test(path);
  const isDefaultOrgHome = /\/organization\/.+$/.test(path) && !isMembersRoute && !isGroupsRoute && !isSettingsRoute && !isDashboardRoute;

  // Fetch groups for this organization
  const { data: groupsData, isLoading: groupsLoading, error: groupsError, refetch: refetchGroups } = useQuery({
    queryKey: ['org-groups', orgId, page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error, count } = await supabase
        .from('groups')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .neq('is_archived', true)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      return { items: (data ?? []) as GroupItem[], count: count ?? 0 };
    },
    enabled: !!orgId && isAuthenticated,
  });

  // Loading state while checking auth/roles
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Organização" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (orgLoading) {
    return (
      <AdminLayout title="Organização" subtitle="Carregando...">
        <LoadingState message="Carregando detalhes da organização..." />
      </AdminLayout>
    );
  }

  // Check access - RLS will return null if no access
  if (orgError || !org) {
    // Distinguish between "not found" and "no access"
    const errorCode = (orgError as any)?.code;
    if (orgError?.message?.includes('permission') || errorCode === 'PGRST301') {
      return (
        <AccessDenied 
          message="Você não tem permissão para acessar esta organização."
        />
      );
    }
    return (
      <AdminLayout title="Organização" subtitle="Erro">
          <ErrorState 
          title="Organização não encontrada"
          message="Não foi possível carregar os detalhes desta organização. Você pode não ter acesso."
          retry={() => navigate('/')}
        />
      </AdminLayout>
    );
  }

  const userCanEditOrg = canEditOrg(orgId!);
  const userCanCreateGroup = isSystemAdmin;

  const groupColumns = [
    { key: 'name', header: 'Nome' },
    { 
      key: 'provider', 
      header: 'Provider',
      render: (group: GroupItem) => (
        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">
          {group.provider}
        </span>
      )
    },
    { 
      key: 'sync_status', 
      header: 'Sync',
      render: (group: GroupItem) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          group.sync_status === 'synced' ? 'bg-success/10 text-success' :
          group.sync_status === 'error' ? 'bg-destructive/10 text-destructive' :
          'bg-muted text-muted-foreground'
        }`}>
          {group.sync_status || '-'}
        </span>
      )
    },
    { 
      key: 'is_active', 
      header: 'Status',
      render: (group: GroupItem) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          group.is_active === true ? 'bg-success/10 text-success' :
          group.is_active === false ? 'bg-muted text-muted-foreground' :
          'bg-muted text-muted-foreground'
        }`}>
          {group.is_active === true ? 'Ativo' : group.is_active === false ? 'Inativo' : '—'}
        </span>
      )
    },
    { 
      key: 'created_at', 
      header: 'Criado em',
      render: (group: GroupItem) => formatDateSimpleBR(group.created_at)
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (group: GroupItem) => {
        const canEdit = canEditGroup(group.id, orgId);
        const canRemove = userCanEditOrg; // apenas ADMIN_DA_ORGANIZAÇÃO ou SYSTEM_ADMIN
        if (!canEdit && !canRemove) return null;
        return (
          <div className="flex items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditGroup(group);
                }}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setRemoveGroup(group);
                }}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Remover grupo da organização"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      }
    },
  ];

  return (
    <AdminLayout 
      title="Organização" 
      subtitle={org.name}
    >
      <div className="space-y-6 animate-fade-in">
        <Breadcrumbs
          items={(
            () => {
              const items = [
                { label: "Central do Bóris", href: "/" },
                { label: org.name },
              ];
              if (isGroupsRoute) items.push({ label: "Grupos" });
              if (isMembersRoute) items.push({ label: "Membros" });
              if (isSettingsRoute) items.push({ label: "Configurações" });
              if (isDashboardRoute) items.push({ label: "Painéis e métricas" });
              return items;
            }
          )()}
        />

        {(isDashboardRoute || isDefaultOrgHome) && (
          <div id="org-dashboard" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Grupos"
              value={groupsData?.count ?? 0}
              subtitle="Total na organização"
              icon={Users}
              helpText="Quantidade de grupos vinculados"
              isLoading={groupsLoading}
            />
            <KpiCard
              title="Membros"
              value={totalMembersCount ?? 0}
              subtitle="Total em todos os grupos"
              icon={Users}
              helpText="Soma de membros em grupos"
              isLoading={membersCountLoading}
            />
            <KpiCard
              title="Mensagens (7d)"
              value={messagesLast7dCount ?? 0}
              subtitle="Últimos 7 dias"
              icon={Mail}
              helpText="Volume recente de mensagens"
              isLoading={messagesCountLoading}
            />
            <KpiCard
              title="Grupos ativos"
              value={activeGroupsCount ?? 0}
              subtitle="Com status ativo"
              icon={Activity}
              helpText="Grupos marcados como ativos"
              isLoading={activeGroupsLoading}
            />
          </div>
        )}

        {/* Organization header */}
        <div className="flex items-center gap-4 p-6 rounded-xl border border-border bg-card">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-card-foreground">{org.name}</h2>
              {org.slug && (
                <span className="text-sm text-muted-foreground font-mono">({org.slug})</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Criada em {formatDateSimpleBR(org.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              org.status === 'active' ? 'bg-success/10 text-success' :
              org.status === 'inactive' ? 'bg-muted text-muted-foreground' :
              'bg-destructive/10 text-destructive'
            }`}>
              {org.status === 'active' ? 'Ativo' : org.status === 'inactive' ? 'Inativo' : 'Suspenso'}
            </span>
            {userCanEditOrg && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOrgOpen(true)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(isSettingsRoute || isDefaultOrgHome) && (
          <div id="org-settings" className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Configurações da Organização</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Nome</span>
                <p className="font-medium text-card-foreground">{org.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Slug</span>
                <p className="font-medium text-card-foreground font-mono">{org.slug || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="font-medium text-card-foreground capitalize">{org.status}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Owner</span>
                <p className="font-medium text-card-foreground">{ownerProfile?.name || org.owner_user_id || '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Descrição / propósito</span>
                {(org.settings && (org.settings as any).description) ? (
                  <p className="font-medium text-card-foreground whitespace-pre-wrap break-words">
                    {(org.settings as any).description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Adicione uma descrição da organização</p>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Criada em</span>
                <p className="font-medium text-card-foreground">
                  {new Date(org.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Atualizada em</span>
                <p className="font-medium text-card-foreground">
                  {new Date(org.updated_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Section: Contato da Organização */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contato da Organização
              </h3>
              {userCanEditOrg && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditContactOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar contato
                </Button>
              )}
            </div>
            {contactLoading ? (
              <p className="text-sm text-muted-foreground">Carregando contato...</p>
            ) : contactError ? (
              <p className="text-sm text-destructive">Falha ao carregar contato</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome</span>
                  <p className="font-medium text-card-foreground">{contactName || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-medium text-card-foreground">{contactEmail || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone</span>
                  <p className="font-medium text-card-foreground">{contactPhone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cargo</span>
                  <p className="font-medium text-card-foreground">{contactRole || '-'}</p>
                </div>
                {!primaryContact && !org?.contact_name && !org?.contact_email && !org?.contact_phone && (
                  <p className="text-xs text-muted-foreground">Nenhum contato primário cadastrado.</p>
                )}
              </div>
            )}
          </div>

          {/* Section: Plano / Billing */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Plano / Billing
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Plano</span>
                <p className="font-medium text-card-foreground capitalize">{org.plan || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status do Billing</span>
                <p className={`font-medium capitalize ${
                  org.billing_status === 'active' ? 'text-success' :
                  org.billing_status === 'overdue' ? 'text-destructive' :
                  'text-muted-foreground'
                }`}>
                  {org.billing_status || '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Início do Trial</span>
                <p className="font-medium text-card-foreground">
                  {org.trial_started_at 
                    ? new Date(org.trial_started_at).toLocaleDateString('pt-BR') 
                    : '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Fim do Trial</span>
                <p className="font-medium text-card-foreground">
                  {org.trial_ends_at 
                    ? new Date(org.trial_ends_at).toLocaleDateString('pt-BR') 
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible sections for JSON data */}
        <div className="space-y-4">
          {/* Settings */}
          {org.settings && Object.keys(org.settings).length > 0 && (
            <Collapsible className="rounded-xl border border-border bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-secondary/30 transition-colors">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Settings</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                  {JSON.stringify(org.settings, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Metadata */}
          {org.metadata && Object.keys(org.metadata).length > 0 && (
            <Collapsible className="rounded-xl border border-border bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-secondary/30 transition-colors">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Metadados</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                  {JSON.stringify(org.metadata, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {(isGroupsRoute || isDefaultOrgHome) && (
        <div id="org-groups">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Grupos ({groupsData?.count ?? 0})
            </h3>
            {userCanCreateGroup && (
              <Button
                onClick={() => setAddGroupOpen(true)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Grupo
              </Button>
            )}
          </div>
          
          {groupsLoading ? (
            <LoadingState message="Carregando grupos..." />
          ) : groupsError ? (
            <ErrorState 
              message="Falha ao carregar grupos"
              retry={() => refetchGroups()}
            />
          ) : groupsData?.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum grupo"
              message="Esta organização ainda não possui grupos cadastrados."
            />
          ) : (
            <DataTable
              columns={groupColumns}
              data={groupsData?.items ?? []}
              keyExtractor={(group) => group.id}
              onRowClick={(group) => navigate(`/groups/${group.id}`)}
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={groupsData?.count}
              onPageChange={setPage}
            />
          )}
        </div>
        )}

        {isMembersRoute && (
        <div id="org-members" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Membros ({orgMembersData?.count ?? 0})
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Buscar membros por nome ou telefone"
                value={membersSearch}
                onChange={(e) => { setMembersSearch(e.target.value); setMembersPage(1); }}
                className="w-64 px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
          </div>
          {orgMembersLoading ? (
            <LoadingState message="Carregando membros..." />
          ) : orgMembersError ? (
            <ErrorState message="Falha ao carregar membros" retry={() => refetchOrgMembers()} />
          ) : (orgMembersData?.items?.length ?? 0) === 0 ? (
            <EmptyState icon={Users} title="Nenhum membro" message="Nenhum membro encontrado nesta organização." />
          ) : (
            <DataTable
              columns={[
                { key: 'name', header: 'Nome' },
                { key: 'phone_e164', header: 'Telefone' },
                { key: 'groups.name', header: 'Grupo', render: (m: any) => m.groups?.name || '-' },
                { key: 'status', header: 'Status', render: (m: any) => (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.left_at ? 'bg-destructive/10 text-destructive' : m.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{m.left_at ? 'Saiu' : m.status}</span>
                ) },
              ]}
              data={orgMembersData?.items ?? []}
              keyExtractor={(m: any) => m.id}
              page={membersPage}
              pageSize={PAGE_SIZE}
              totalCount={orgMembersData?.count}
              onPageChange={setMembersPage}
            />
          )}
        </div>
        )}
      </div>

      {/* Edit organization modal */}
      <EditOrganizationModal
        organization={org}
        open={editOrgOpen}
        onOpenChange={setEditOrgOpen}
        onSuccess={() => refetchOrg()}
      />

      <EditOrganizationContactModal
        organizationId={orgId!}
        contact={primaryContact ?? null}
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        onSuccess={() => refetchPrimaryContact()}
      />

      {/* Edit group modal */}
      <EditGroupModal
        group={editGroup}
        open={!!editGroup}
        onOpenChange={(open) => !open && setEditGroup(null)}
        onSuccess={() => refetchGroups()}
      />

      {/* Add group modal */}
      <AddGroupModal
        organizationId={orgId!}
        organizationName={org.name}
        open={addGroupOpen}
        onOpenChange={setAddGroupOpen}
        onSuccess={(groupId) => {
          refetchGroups();
          navigate(`/groups/${groupId}`);
        }}
      />

      {/* Remove group confirmation */}
      <AlertDialog open={!!removeGroup} onOpenChange={(open) => !open && setRemoveGroup(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">Remover grupo da organização</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação desvincula o grupo da organização e não apaga dados históricos. 
              O grupo deixará de aparecer nesta organização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mr-2">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!removeGroup) return;
                setRemoving(true);
                try {
                  // Primeiro, tentar arquivar o grupo para removê-lo da listagem
                  const { error } = await supabase
                    .from('groups')
                    .update({ is_archived: true })
                    .eq('id', removeGroup.id);
                  if (error) throw error;
                  toast.success('Grupo removido da organização com sucesso');
                  setRemoveGroup(null);
                  refetchGroups();
                } catch (err: any) {
                  toast.error(err.message || 'Erro ao remover grupo');
                } finally {
                  setRemoving(false);
                }
              }}
              disabled={removing}
            >
              Confirmar remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default Org;
