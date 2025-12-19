import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Users, Building2 } from "lucide-react";
import { toast } from "sonner";

interface GroupItem {
  id: string;
  name: string;
  organization_id: string;
  provider: string | null;
  status: "active" | "inactive";
}

interface OrganizationOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 10;

const SystemGroups = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [orderBy, setOrderBy] = useState<"name" | "created_at">("created_at");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");

  const [removeGroup, setRemoveGroup] = useState<GroupItem | null>(null);
  const [groupDeleteConfirmText, setGroupDeleteConfirmText] = useState("");
  const [removingGroup, setRemovingGroup] = useState(false);

  const { data: orgsOptions } = useQuery({
    queryKey: ["system-groups-org-options"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name", { ascending: true });
      return (data ?? []) as OrganizationOption[];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const { data: groupsData, isLoading, error, refetch } = useQuery({
    queryKey: [
      "system-groups",
      page,
      search,
      orgFilter,
      status,
      orderBy,
      orderDir,
    ],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("groups")
        .select("id, name, provider, organization_id, status, created_at", { count: "exact" })
        .is("deleted_at", null)
        .neq("is_archived", true);

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      if (orgFilter) {
        query = query.eq("organization_id", orgFilter);
      }

      if (status !== "all") {
        query = query.eq("status", status);
      }

      query = query.order(orderBy, { ascending: orderDir === "asc" });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      return { items: (data ?? []) as GroupItem[], count: count ?? 0 };
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const toggleStatus = async (group: GroupItem) => {
    const next = group.status === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("groups")
      .update({ status: next })
      .eq("id", group.id);
    if (error) {
      toast.error(error.message || "Erro ao atualizar status");
      return;
    }
    toast.success(next === "active" ? "Grupo reativado" : "Grupo desativado");
    refetch();
  };

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Sistema › Grupos" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const orgName = (id: string) => orgsOptions?.find((o) => o.id === id)?.name || "Organização";

  const columns = [
    { key: "name", header: "Nome" },
    {
      key: "organization_id",
      header: "Organização",
      render: (g: GroupItem) => <span>{orgName(g.organization_id)}</span>,
    },
    { key: "provider", header: "Provedor", render: (g: GroupItem) => <span>{g.provider || "-"}</span> },
    {
      key: "status",
      header: "Status",
      render: (g: GroupItem) => (
        <span className={g.status === "active" ? "text-success" : "text-muted-foreground"}>
          {g.status === "active" ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      render: (g: GroupItem) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => navigate(`/group/${g.id}`)}>Abrir</Button>
          <Button size="sm" variant="outline" onClick={() => toggleStatus(g)}>
            {g.status === "active" ? "Desativar" : "Reativar"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setRemoveGroup(g)}>
            Excluir
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <AdminLayout title="Sistema › Grupos" subtitle="Gestão de grupos">
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Sistema", href: "/system" }, { label: "Grupos" }]} />

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Grupos
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-56 px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={orgFilter}
              onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
            >
              <option value="">Todas as organizações</option>
              {(orgsOptions ?? []).map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
            >
              <option value="created_at">Ordenar por Data</option>
              <option value="name">Ordenar por Nome</option>
            </select>
            <select
              value={orderDir}
              onChange={(e) => setOrderDir(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
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
      </div>

      <AlertDialog open={!!removeGroup} onOpenChange={(open) => !open && setRemoveGroup(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">Excluir grupo</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação é irreversível e removerá o grupo e todos os dados vinculados.
              Para confirmar, digite o nome do grupo (<strong>{removeGroup?.name}</strong>)
              ou escreva <strong>EXCLUIR</strong> no campo abaixo.
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
                const confirmed = groupDeleteConfirmText.trim().toLowerCase() === "excluir" || groupDeleteConfirmText.trim() === removeGroup.name;
                if (!confirmed) {
                  toast.error("Confirmação inválida. Digite o nome do grupo ou EXCLUIR.");
                  return;
                }
                setRemovingGroup(true);
                try {
                  const { error } = await supabase
                    .from("groups")
                    .delete()
                    .eq("id", removeGroup.id);
                  if (error) throw error;
                  toast.success("Grupo excluído com sucesso");
                  setRemoveGroup(null);
                  setGroupDeleteConfirmText("");
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
    </AdminLayout>
  );
};

export default SystemGroups;
