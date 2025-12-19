import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useNavigate } from "react-router-dom";
import { Layers, Building2, Users, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
const PAGE_SIZE = 10;

interface Organization {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

const System = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  const [orgSearch, setOrgSearch] = useState("");
  const [orgOrderBy, setOrgOrderBy] = useState<"name" | "created_at">("name");
  const [orgOrderDir, setOrgOrderDir] = useState<"asc" | "desc">("asc");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupOrderBy, setGroupOrderBy] = useState<"name" | "created_at">("created_at");
  const [groupOrderDir, setGroupOrderDir] = useState<"asc" | "desc">("desc");
  const [groupOrgFilter, setGroupOrgFilter] = useState<string>("");

  const [removeOrg, setRemoveOrg] = useState<Organization | null>(null);
  const [removingOrg, setRemovingOrg] = useState(false);
  const [removeGroup, setRemoveGroup] = useState<any | null>(null);
  const [removingGroup, setRemovingGroup] = useState(false);
  const [orgShowInactive, setOrgShowInactive] = useState(false);
  const [groupShowInactive, setGroupShowInactive] = useState(false);
  const [orgDeleteConfirmText, setOrgDeleteConfirmText] = useState("");
  const [groupDeleteConfirmText, setGroupDeleteConfirmText] = useState("");

  // Debounced search terms to reduce query churn
  const [debouncedOrgSearch, setDebouncedOrgSearch] = useState(orgSearch);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedOrgSearch(orgSearch), 300);
    return () => clearTimeout(t);
  }, [orgSearch]);

  const [debouncedGroupSearch, setDebouncedGroupSearch] = useState(groupSearch);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedGroupSearch(groupSearch), 300);
    return () => clearTimeout(t);
  }, [groupSearch]);

  // Fetch organizations with pagination
  const { data: orgsData, isLoading: orgsLoading, error: orgsError, refetch: refetchOrgs } = useQuery({
    queryKey: ['organizations', page, debouncedOrgSearch, orgOrderBy, orgOrderDir],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from('organizations')
        .select('id, name, status, created_at', { count: 'exact' });

      if (debouncedOrgSearch) {
        query = query.ilike('name', `%${debouncedOrgSearch}%`);
      }

      if (!orgShowInactive) {
        query = query.eq('status', 'active');
      }

      query = query.order(orgOrderBy, { ascending: orgOrderDir === 'asc' });

      const { data, error, count } = await query.range(from, to);
      
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
    },
    enabled: isAuthenticated,
  });

  // Group counts per organization (only for visible organizations on current page)
  const orgIds = useMemo(() => (orgsData?.items ?? []).map((o: any) => o.id), [orgsData]);
  const { data: orgGroupCounts } = useQuery({
    queryKey: ['org-group-counts', orgIds],
    queryFn: async () => {
      if (!orgIds || orgIds.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from('groups')
        .select('organization_id, id')
        .in('organization_id', orgIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((g: any) => {
        const key = g.organization_id as string;
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    },
    enabled: isAuthenticated && orgIds.length > 0,
  });

  // Fetch groups list with search/filter
  const { data: groupsData, isLoading: groupsLoading, error: groupsError, refetch: refetchGroups } = useQuery({
    queryKey: ['system-groups', groupPage, debouncedGroupSearch, groupOrderBy, groupOrderDir, groupOrgFilter],
    queryFn: async () => {
      const from = (groupPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('groups')
        .select('id, name, provider, status, organization_id, organizations(name)', { count: 'exact' });

      if (debouncedGroupSearch) {
        query = query.ilike('name', `%${debouncedGroupSearch}%`);
      }
      if (groupOrgFilter) {
        query = query.eq('organization_id', groupOrgFilter);
      }

      if (!groupShowInactive) {
        query = query.eq('status', 'active');
      }

      query = query.order(groupOrderBy, { ascending: groupOrderDir === 'asc' });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
    },
    enabled: isAuthenticated,
  });

  // Loading state while checking auth/roles
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Sistema" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  // Check if user is SYSTEM_ADMIN
  if (!isSystemAdmin) {
    return (
      <AccessDenied 
        message="A página /system é restrita a administradores do sistema (SYSTEM_ADMIN)."
      />
    );
  }

  const orgColumns = [
    { key: 'name', header: 'Nome' },
    { 
      key: 'status', 
      header: 'Status',
      render: (org: Organization) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          org.status === 'active' ? 'bg-success/10 text-success' :
          org.status === 'inactive' ? 'bg-muted text-muted-foreground' :
          'bg-destructive/10 text-destructive'
        }`}>
          {org.status === 'active' ? 'Ativo' : org.status === 'inactive' ? 'Inativo' : 'Suspenso'}
        </span>
      )
    },
    {
      key: 'groups_count',
      header: 'Grupos',
      render: (org: Organization) => (
        <span className="text-sm text-muted-foreground">
          {orgGroupCounts?.[org.id] ?? 0}
        </span>
      )
    },
    { 
      key: 'created_at', 
      header: 'Criado em',
      render: (org: Organization) => new Date(org.created_at).toLocaleDateString('pt-BR')
    },
    {
      key: 'actions',
      header: 'Ações',
      className: 'text-right w-0',
      render: (org: Organization) => (
        <Button
          variant="ghost"
          size="icon"
          title="Excluir organização"
          onClick={(e) => { e.stopPropagation(); setRemoveOrg(org); }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )
    },
  ];

  const groupColumns = [
    { key: 'name', header: 'Nome' },
    { 
      key: 'organizations',
      header: 'Organização',
      render: (g: any) => (
        <span className="text-sm text-muted-foreground">{g.organizations?.name || '-'}</span>
      )
    },
    {
      key: 'provider',
      header: 'Provedor',
      render: (g: any) => (
        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">
          {g.provider}
        </span>
      )
    },
    { 
      key: 'status',
      header: 'Status',
      render: (g: any) => (
        <span className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium',
          g.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
        )}>
          {g.status || 'indefinido'}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Ações',
      className: 'text-right w-0',
      render: (g: any) => (
        <Button
          variant="ghost"
          size="icon"
          title="Excluir grupo"
          onClick={(e) => { e.stopPropagation(); setRemoveGroup(g); }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )
    },
  ];

  return (
    <AdminLayout 
      title="Sistema" 
      subtitle="Visão global exclusiva para administradores do sistema"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Page header */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Visão Global do Sistema</h2>
            <p className="text-sm text-muted-foreground">Acesso rápido a todas as Organizações e Grupos</p>
          </div>
        </div>

        {/* Two-column layout: Organizations and Groups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Organizations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organizações
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar por nome..."
                  value={orgSearch}
                  onChange={(e) => { setOrgSearch(e.target.value); setPage(1); }}
                  className="w-52 px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={orgShowInactive}
                    onChange={(e) => { setOrgShowInactive(e.target.checked); setPage(1); }}
                  />
                  Mostrar inativas
                </label>
                <select
                  value={orgOrderBy}
                  onChange={(e) => setOrgOrderBy(e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
                >
                  <option value="name">Ordenar por Nome</option>
                  <option value="created_at">Ordenar por Data</option>
                </select>
                <select
                  value={orgOrderDir}
                  onChange={(e) => setOrgOrderDir(e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </div>
            {orgsLoading ? (
              <LoadingState message="Carregando organizações..." />
            ) : orgsError ? (
              <ErrorState message="Falha ao carregar organizações" retry={() => refetchOrgs()} />
            ) : orgsData?.items.length === 0 ? (
              <EmptyState icon={Building2} title="Nenhuma organização" message="Não há organizações cadastradas." />
            ) : (
              <DataTable
                columns={orgColumns}
                data={orgsData?.items ?? []}
                keyExtractor={(org) => org.id}
                onRowClick={(org) => navigate(`/org/${org.id}`)}
                page={page}
                pageSize={PAGE_SIZE}
                totalCount={orgsData?.count}
                onPageChange={setPage}
              />
            )}
          </div>

          {/* Groups */}
          <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Grupos
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={groupSearch}
                    onChange={(e) => { setGroupSearch(e.target.value); setGroupPage(1); }}
                    className="w-52 px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <select
                    value={groupOrgFilter}
                    onChange={(e) => { setGroupOrgFilter(e.target.value); setGroupPage(1); }}
                    className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
                  >
                    <option value="">Todas as organizações</option>
                    {(orgsData?.items ?? []).map((org: any) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={groupShowInactive}
                      onChange={(e) => { setGroupShowInactive(e.target.checked); setGroupPage(1); }}
                    />
                    Mostrar inativos
                  </label>
                  <select
                    value={groupOrderBy}
                    onChange={(e) => setGroupOrderBy(e.target.value as any)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
                  >
                    <option value="created_at">Ordenar por Data</option>
                    <option value="name">Ordenar por Nome</option>
                  </select>
                  <select
                    value={groupOrderDir}
                    onChange={(e) => setGroupOrderDir(e.target.value as any)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
                  >
                    <option value="asc">Asc</option>
                    <option value="desc">Desc</option>
                  </select>
                </div>
              </div>
            {groupsLoading ? (
              <LoadingState message="Carregando grupos..." />
            ) : groupsError ? (
              <ErrorState message="Falha ao carregar grupos" retry={() => refetchGroups()} />
            ) : groupsData?.items.length === 0 ? (
              <EmptyState icon={Users} title="Nenhum grupo" message="Não há grupos cadastrados." />
            ) : (
              <DataTable
                columns={groupColumns}
                data={groupsData?.items ?? []}
                keyExtractor={(g) => g.id}
                onRowClick={(g) => navigate(`/group/${g.id}`)}
                page={groupPage}
                pageSize={PAGE_SIZE}
                totalCount={groupsData?.count}
                onPageChange={setGroupPage}
              />
            )}
          </div>
        </div>
        
        <AlertDialog open={!!removeOrg} onOpenChange={(open) => !open && setRemoveOrg(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir organização</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível e removerá a organização e todos os dados vinculados em cascata:
                grupos, membros, mensagens, reações, e demais registros relacionados.
                Para confirmar, digite o nome da organização (<strong>{removeOrg?.name}</strong>)
                ou escreva <strong>EXCLUIR</strong> no campo abaixo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-3">
              <input
                type="text"
                value={orgDeleteConfirmText}
                onChange={(e) => setOrgDeleteConfirmText(e.target.value)}
                placeholder={`Digite "${removeOrg?.name}" ou "EXCLUIR"`}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Isso remove todos os dados em cascata e não pode ser desfeito.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!removeOrg) return;
                  const confirmed = orgDeleteConfirmText.trim().toLowerCase() === 'excluir' || orgDeleteConfirmText.trim() === removeOrg.name;
                  if (!confirmed) {
                    toast.error('Confirmação inválida. Digite o nome da organização ou EXCLUIR.');
                    return;
                  }
                  setRemovingOrg(true);
                  try {
                    const { error } = await supabase
                      .from('organizations')
                      .delete()
                      .eq('id', removeOrg.id);
                    if (error) throw error;
                    toast.success('Organização excluída com sucesso');
                    setRemoveOrg(null);
                    setOrgDeleteConfirmText("");
                    refetchOrgs();
                  } catch (err: any) {
                    toast.error(err.message || 'Erro ao excluir organização');
                  } finally {
                    setRemovingOrg(false);
                  }
                }}
                disabled={removingOrg}
              >
                Confirmar exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!removeGroup} onOpenChange={(open) => !open && setRemoveGroup(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir grupo</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível e removerá o grupo e todos os dados vinculados em cascata:
                membros, mensagens, reações e demais registros relacionados. Para confirmar, digite o
                nome do grupo (<strong>{removeGroup?.name}</strong>) ou escreva <strong>EXCLUIR</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-3">
              <input
                type="text"
                value={groupDeleteConfirmText}
                onChange={(e) => setGroupDeleteConfirmText(e.target.value)}
                placeholder={`Digite "${removeGroup?.name}" ou "EXCLUIR"`}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Isso remove todos os dados em cascata e não pode ser desfeito.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!removeGroup) return;
                  const confirmed = groupDeleteConfirmText.trim().toLowerCase() === 'excluir' || groupDeleteConfirmText.trim() === removeGroup.name;
                  if (!confirmed) {
                    toast.error('Confirmação inválida. Digite o nome do grupo ou EXCLUIR.');
                    return;
                  }
                  setRemovingGroup(true);
                  try {
                    const { error } = await supabase
                      .from('groups')
                      .delete()
                      .eq('id', removeGroup.id);
                    if (error) throw error;
                    toast.success('Grupo excluído com sucesso');
                    setRemoveGroup(null);
                    setGroupDeleteConfirmText("");
                    refetchGroups();
                    refetchOrgs();
                  } catch (err: any) {
                    toast.error(err.message || 'Erro ao excluir grupo');
                  } finally {
                    setRemovingGroup(false);
                  }
                }}
                disabled={removingGroup}
              >
                Confirmar exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AdminLayout>
  );
};

export default System;
