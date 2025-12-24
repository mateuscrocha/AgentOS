import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Users, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
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
import { useNavigate } from "react-router-dom";

interface GroupRow {
  id: string;
  name: string;
  provider: string;
  status: string | null;
  organization_id: string;
  organizations?: { name: string } | null;
}

interface OrganizationOption { id: string; name: string; }

const PAGE_SIZE = 10;

export default function SystemGroups() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [orderBy, setOrderBy] = useState<"created_at" | "name">("created_at");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");
  const [removeGroup, setRemoveGroup] = useState<GroupRow | null>(null);
  const [removingGroup, setRemovingGroup] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: organizations } = useQuery({
    queryKey: ["groups-organizations-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as OrganizationOption[];
    },
    enabled: isAuthenticated,
  });

  const { data: groupsData, isLoading, error, refetch } = useQuery({
    queryKey: ["system-groups", page, debouncedSearch, statusFilter, orgFilter, orderBy, orderDir],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("groups")
        .select("id, name, provider, status, organization_id, organizations(name)", { count: "exact" });

      if (debouncedSearch) {
        query = query.ilike("name", `%${debouncedSearch}%`);
      }
      if (orgFilter) {
        query = query.eq("organization_id", orgFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      query = query.order(orderBy, { ascending: orderDir === "asc" });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { items: (data ?? []) as GroupRow[], count: count ?? 0 };
    },
    enabled: isAuthenticated,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      const { error } = await supabase
        .from("groups")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar status");
    },
  });

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Gerenciar grupos" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const columns = [
    { key: "name", header: "Nome" },
    {
      key: "organizations",
      header: "Organização",
      render: (g: GroupRow) => (
        <span className="text-sm text-muted-foreground">{g.organizations?.name || "-"}</span>
      ),
    },
    {
      key: "provider",
      header: "Provedor",
      render: (g: GroupRow) => (
        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">
          {g.provider}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (g: GroupRow) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          g.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
        }`}>
          {g.status || "indefinido"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "text-right w-0",
      render: (g: GroupRow) => (
        <div className="flex items-center justify-end gap-2">
          {g.status === "active" ? (
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: g.id, status: "inactive" }); }}>
              Desativar
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: g.id, status: "active" }); }}>
              Reativar
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Excluir grupo"
            onClick={(e) => { e.stopPropagation(); setRemoveGroup(g); }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Gerenciar grupos" subtitle="Central de Comando › Grupos">
      <div className="space-y-6 animate-fade-in">
        <Breadcrumbs items={[{ label: "Central de Comando", href: "/" }, { label: "Grupos" }]} />

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-64 px-3 py-2 rounded-lg border border-border bg-card text-sm"
          />
          <select
            value={orgFilter}
            onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Todas as organizações</option>
            {(organizations ?? []).map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="created_at">Ordenar por Data</option>
            <option value="name">Ordenar por Nome</option>
          </select>
          <select
            value={orderDir}
            onChange={(e) => setOrderDir(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>

        {isLoading ? (
          <LoadingState message="Carregando grupos..." />
        ) : error ? (
          <ErrorState message="Falha ao carregar grupos" retry={() => refetch()} />
        ) : groupsData?.items.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum grupo" message="Não há grupos cadastrados." />
        ) : (
          <DataTable
            columns={columns}
            data={groupsData?.items ?? []}
            keyExtractor={(g) => g.id}
            onRowClick={(g) => navigate(`/group/${g.id}`)}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={groupsData?.count}
            onPageChange={setPage}
          />
        )}

        <AlertDialog open={!!removeGroup} onOpenChange={(open) => !open && setRemoveGroup(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir grupo</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível e removerá o grupo do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!removeGroup) return;
                  setRemovingGroup(true);
                  try {
                    const { error } = await supabase
                      .from("groups")
                      .delete()
                      .eq("id", removeGroup.id);
                    if (error) throw error;
                    toast.success("Grupo excluído com sucesso");
                    setRemoveGroup(null);
                    refetch();
                  } catch (err: any) {
                    toast.error(err.message || "Erro ao excluir grupo");
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
}
