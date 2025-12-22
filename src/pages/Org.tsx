import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams, useNavigate } from "react-router-dom";
import { Building2, Users, Edit, ChevronDown, CreditCard, Mail, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";
import { EditOrganizationContactModal } from "@/components/modals/EditOrganizationContactModal";
import { EditGroupModal } from "@/components/modals/EditGroupModal";
import { AddGroupModal } from "@/components/modals/AddGroupModal";
import { Button } from "@/components/ui/button";
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
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { canEditOrg, canEditGroup, isLoading: rolesLoading } = useUserRoles();
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
          retry={() => navigate('/system')}
        />
      </AdminLayout>
    );
  }

  const userCanEditOrg = canEditOrg(orgId!);
  const userCanCreateGroup = userCanEditOrg; // Same permission for creating groups

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
      render: (group: GroupItem) => new Date(group.created_at).toLocaleDateString('pt-BR')
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
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Sistema", href: "/system" },
            { label: org.name },
          ]}
        />

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
              Criada em {new Date(org.created_at).toLocaleDateString('pt-BR')}
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

        {/* Detail Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section: Configurações da Organização */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
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
                  <p className="font-medium text-card-foreground">{primaryContact?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-medium text-card-foreground">{primaryContact?.email || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone</span>
                  <p className="font-medium text-card-foreground">{primaryContact?.phone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cargo</span>
                  <p className="font-medium text-card-foreground">{primaryContact?.role_title || '-'}</p>
                </div>
                {!primaryContact && (
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

        {/* Groups list */}
        <div>
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
              onRowClick={(group) => navigate(`/group/${group.id}`)}
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={groupsData?.count}
              onPageChange={setPage}
            />
          )}
        </div>
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
          navigate(`/group/${groupId}`);
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
