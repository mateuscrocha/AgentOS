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
import { Building2 } from "lucide-react";
import { toast } from "sonner";

interface OrganizationItem {
  id: string;
  name: string;
  status: "active" | "inactive";
  created_at: string;
  groupCount?: number;
}

const PAGE_SIZE = 10;

const SystemOrganizations = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [orderBy, setOrderBy] = useState<"name" | "created_at">("name");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");

  const [removeOrg, setRemoveOrg] = useState<OrganizationItem | null>(null);
  const [orgDeleteConfirmText, setOrgDeleteConfirmText] = useState("");
  const [removingOrg, setRemovingOrg] = useState(false);

  const { data: orgsData, isLoading, error, refetch } = useQuery({
    queryKey: [
      "system-organizations",
      page,
      search,
      status,
      orderBy,
      orderDir,
    ],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("organizations")
        .select("id, name, status, created_at", { count: "exact" });

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      if (status !== "all") {
        query = query.eq("status", status);
      }

      query = query.order(orderBy, { ascending: orderDir === "asc" });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      const withCounts = await Promise.all(
        (data ?? []).map(async (org) => {
          const { count: groupCount } = await supabase
            .from("groups")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .is("deleted_at", null)
            .neq("is_archived", true);
          return { ...org, groupCount: groupCount ?? 0 } as OrganizationItem;
        })
      );

      return { items: withCounts, count: count ?? 0 } as {
        items: OrganizationItem[];
        count: number;
      };
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const toggleStatus = async (org: OrganizationItem) => {
    const next = org.status === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("organizations")
      .update({ status: next })
      .eq("id", org.id);
    if (error) {
      toast.error(error.message || "Erro ao atualizar status");
      return;
    }
    toast.success(
      next === "active" ? "Organização reativada" : "Organização desativada"
    );
    refetch();
  };

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Sistema › Organizações" subtitle="Carregando...">
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
      key: "status",
      header: "Status",
      render: (org: OrganizationItem) => (
        <span className={org.status === "active" ? "text-success" : "text-muted-foreground"}>
          {org.status === "active" ? "Ativa" : "Inativa"}
        </span>
      ),
    },
    {
      key: "groupCount",
      header: "Grupos",
      render: (org: OrganizationItem) => <span>{org.groupCount ?? 0}</span>,
    },
    {
      key: "created_at",
      header: "Criado em",
      render: (org: OrganizationItem) => new Date(org.created_at).toLocaleDateString("pt-BR"),
      className: "text-right",
    },
    {
      key: "actions",
      header: "Ações",
      render: (org: OrganizationItem) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => navigate(`/org/${org.id}`)}>Abrir</Button>
          <Button size="sm" variant="outline" onClick={() => toggleStatus(org)}>
            {org.status === "active" ? "Desativar" : "Reativar"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setRemoveOrg(org)}>
            Excluir
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <AdminLayout title="Sistema › Organizações" subtitle="Gestão de organizações">
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Sistema", href: "/system" }, { label: "Organizações" }]} />

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organizações
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
              value={status}
              onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
            >
              <option value="all">Todas</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </select>
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs"
            >
              <option value="name">Ordenar por Nome</option>
              <option value="created_at">Ordenar por Data</option>
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
          <LoadingState message="Carregando organizações..." />
        ) : error ? (
          <ErrorState message="Falha ao carregar organizações" retry={() => refetch()} />
        ) : orgsData?.items.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhuma organização" message="Não há organizações cadastradas." />
        ) : (
          <DataTable
            columns={columns}
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

      <AlertDialog open={!!removeOrg} onOpenChange={(open) => !open && setRemoveOrg(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">Excluir organização</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação é irreversível e removerá a organização e todos os dados vinculados.
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
                const confirmed = orgDeleteConfirmText.trim().toLowerCase() === "excluir" || orgDeleteConfirmText.trim() === removeOrg.name;
                if (!confirmed) {
                  toast.error("Confirmação inválida. Digite o nome da organização ou EXCLUIR.");
                  return;
                }
                setRemovingOrg(true);
                try {
                  const { error } = await supabase
                    .from("organizations")
                    .delete()
                    .eq("id", removeOrg.id);
                  if (error) throw error;
                  toast.success("Organização excluída com sucesso");
                  setRemoveOrg(null);
                  setOrgDeleteConfirmText("");
                  refetch();
                } catch (err: any) {
                  toast.error(err.message || "Erro ao excluir organização");
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
    </AdminLayout>
  );
};

export default SystemOrganizations;
