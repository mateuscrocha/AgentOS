import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useParams, useNavigate } from "react-router-dom";
import { Building2, Users, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const PAGE_SIZE = 10;

interface GroupItem {
  id: string;
  name: string;
  provider: string;
  created_at: string;
  organization_id: string;
  provider_group_id: string | null;
}

const Org = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  // Fetch organization details
  const { data: org, isLoading: orgLoading, error: orgError } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
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
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
    },
    enabled: !!orgId,
  });

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
      key: 'created_at', 
      header: 'Criado em',
      render: (group: GroupItem) => new Date(group.created_at).toLocaleDateString('pt-BR')
    },
  ];

  if (orgLoading) {
    return (
      <AdminLayout title="Organização" subtitle="Carregando...">
        <LoadingState message="Carregando detalhes da organização..." />
      </AdminLayout>
    );
  }

  if (orgError || !org) {
    return (
      <AdminLayout title="Organização" subtitle="Erro">
        <ErrorState 
          title="Organização não encontrada"
          message="Não foi possível carregar os detalhes desta organização."
          retry={() => navigate('/system')}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Organização" 
      subtitle={org.name}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Back button */}
        <button
          onClick={() => navigate('/system')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Sistema
        </button>

        {/* Organization header */}
        <div className="flex items-center gap-4 p-6 rounded-xl border border-border bg-card">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-card-foreground">{org.name}</h2>
            <p className="text-sm text-muted-foreground">
              Criada em {new Date(org.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            org.status === 'active' ? 'bg-success/10 text-success' :
            org.status === 'inactive' ? 'bg-muted text-muted-foreground' :
            'bg-destructive/10 text-destructive'
          }`}>
            {org.status === 'active' ? 'Ativo' : org.status === 'inactive' ? 'Inativo' : 'Suspenso'}
          </span>
        </div>

        {/* Groups list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Grupos ({groupsData?.count ?? 0})
            </h3>
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
    </AdminLayout>
  );
};

export default Org;
