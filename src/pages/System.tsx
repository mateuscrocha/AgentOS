import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useNavigate } from "react-router-dom";
import { Layers, Building2, Users, Edit } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";
import { Button } from "@/components/ui/button";

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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  const [editOrg, setEditOrg] = useState<Organization | null>(null);

  // Fetch organizations with pagination
  const { data: orgsData, isLoading: orgsLoading, error: orgsError, refetch: refetchOrgs } = useQuery({
    queryKey: ['organizations', page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error, count } = await supabase
        .from('organizations')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
    },
    enabled: isAuthenticated,
  });

  // Fetch recent groups
  const { data: recentGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ['recent-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, organization_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data ?? [];
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
      key: 'created_at', 
      header: 'Criado em',
      render: (org: Organization) => new Date(org.created_at).toLocaleDateString('pt-BR')
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (org: Organization) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setEditOrg(org);
          }}
          className="h-8 w-8 p-0"
        >
          <Edit className="h-4 w-4" />
        </Button>
      )
    },
  ];

  return (
    <AdminLayout 
      title="Sistema" 
      subtitle="Configurações globais e visão geral do sistema"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Page header */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Visão do Sistema</h2>
            <p className="text-sm text-muted-foreground">Gerencie organizações, configurações globais e métricas</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Organizations list */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organizações
              </h3>
            </div>
            
            {orgsLoading ? (
              <LoadingState message="Carregando organizações..." />
            ) : orgsError ? (
              <ErrorState 
                message="Falha ao carregar organizações"
                retry={() => refetchOrgs()}
              />
            ) : orgsData?.items.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="Nenhuma organização"
                message="Não há organizações cadastradas no sistema."
              />
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

          {/* Recent groups */}
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Users className="h-4 w-4" />
              Grupos Recentes
            </h3>
            
            <div className="rounded-xl border border-border bg-card">
              {groupsLoading ? (
                <LoadingState message="Carregando grupos..." className="py-8" />
              ) : recentGroups?.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhum grupo"
                  message="Não há grupos cadastrados."
                  className="py-8"
                />
              ) : (
                <div className="divide-y divide-border">
                  {recentGroups?.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => navigate(`/group/${group.id}`)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {group.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(group.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit organization modal */}
      <EditOrganizationModal
        organization={editOrg}
        open={!!editOrg}
        onOpenChange={(open) => !open && setEditOrg(null)}
        onSuccess={() => refetchOrgs()}
      />
    </AdminLayout>
  );
};

export default System;
