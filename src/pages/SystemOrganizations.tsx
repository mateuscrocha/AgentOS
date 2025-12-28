import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Building2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
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
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";

interface Organization {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

const PAGE_SIZE = 10;

export default function SystemOrganizations() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [orderBy, setOrderBy] = useState<"name" | "created_at">("name");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
  const [removeOrg, setRemoveOrg] = useState<Organization | null>(null);
  const [removingOrg, setRemovingOrg] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [cascadeOrg, setCascadeOrg] = useState<Organization | null>(null);
  const [confirmCascadeName, setConfirmCascadeName] = useState("");
  const [deletingCascade, setDeletingCascade] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: orgsData, isLoading: orgsLoading, error: orgsError, refetch: refetchOrgs } = useQuery({
    queryKey: ["system-organizations", page, debouncedSearch, statusFilter, orderBy, orderDir],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("organizations")
        .select("id, name, status, created_at", { count: "exact" });

      if (debouncedSearch) {
        query = query.ilike("name", `%${debouncedSearch}%`);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      query = query.order(orderBy, { ascending: orderDir === "asc" });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { items: (data ?? []) as Organization[], count: count ?? 0 };
    },
    enabled: isAuthenticated,
  });

  const orgIds = useMemo(() => (orgsData?.items ?? []).map((o) => o.id), [orgsData]);
  const { data: orgGroupCounts } = useQuery({
    queryKey: ["org-group-counts", orgIds],
    queryFn: async () => {
      if (!orgIds || orgIds.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from("groups")
        .select("organization_id, id")
        .in("organization_id", orgIds);
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      refetchOrgs();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar status");
    },
  });

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Gerenciar organizações" subtitle="Carregando...">
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
      render: (org: Organization) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          org.status === "active" ? "bg-success/10 text-success" : org.status === "inactive" ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive"
        }`}>
          {org.status === "active" ? "Ativa" : org.status === "inactive" ? "Inativa" : org.status}
        </span>
      ),
    },
    {
      key: "groups_count",
      header: "Grupos",
      render: (org: Organization) => (
        <span className="text-sm text-muted-foreground">{orgGroupCounts?.[org.id] ?? 0}</span>
      ),
    },
    {
      key: "created_at",
      header: "Criado em",
      render: (org: Organization) => formatDateSimpleBR(org.created_at),
    },
    {
      key: "actions",
      header: "Ações",
      className: "text-right w-0",
      render: (org: Organization) => (
        <div className="flex items-center justify-end gap-2">
          {org.status === "active" ? (
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: org.id, status: "inactive" }); }}>
              Desativar
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: org.id, status: "active" }); }}>
              Reativar
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Excluir organização"
            onClick={(e) => { e.stopPropagation(); setRemoveOrg(org); }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setCascadeOrg(org); setConfirmCascadeName(""); }}
          >
            Excluir em cascata
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Gerenciar organizações" subtitle="Central de Comando › Organizações">
      <div className="space-y-6 animate-fade-in">
        <Breadcrumbs items={[{ label: "Central de Comando", href: "/" }, { label: "Organizações" }]} />

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-64 px-3 py-2 rounded-lg border border-border bg-card text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="all">Todas</option>
            <option value="active">Ativas</option>
            <option value="inactive">Inativas</option>
          </select>
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="name">Ordenar por Nome</option>
            <option value="created_at">Ordenar por Data</option>
          </select>
          <select
            value={orderDir}
            onChange={(e) => setOrderDir(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <Button onClick={() => setCreateOrgOpen(true)} className="ml-auto">
            Nova organização
          </Button>
        </div>

        {orgsLoading ? (
          <LoadingState message="Carregando organizações..." />
        ) : orgsError ? (
          <ErrorState message="Falha ao carregar organizações" retry={() => refetchOrgs()} />
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

        <AlertDialog open={!!removeOrg} onOpenChange={(open) => !open && setRemoveOrg(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir organização</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível e removerá a organização do sistema. Se houver grupos associados,
                a exclusão será bloqueada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!removeOrg) return;
                  const groupsCount = orgGroupCounts?.[removeOrg.id] ?? 0;
                  if (groupsCount > 0) {
                    toast.error("A organização possui grupos. Exclua os grupos antes de excluir a organização.");
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
                    refetchOrgs();
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

        <AlertDialog open={!!cascadeOrg} onOpenChange={(open) => !open && setCascadeOrg(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir organização em cascata</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível e removerá a organização e todos os seus grupos e dados associados.
                Digite o nome da organização para confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <input
                type="text"
                value={confirmCascadeName}
                onChange={(e) => setConfirmCascadeName(e.target.value)}
                placeholder={cascadeOrg?.name || "Nome da organização"}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2" onClick={() => setCascadeOrg(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!cascadeOrg) return;
                  if (confirmCascadeName !== cascadeOrg.name) {
                    toast.error("O nome digitado não confere");
                    return;
                  }
                  setDeletingCascade(true);
                  try {
                    const { error } = await supabase.functions.invoke("delete-resource-cascade", {
                      body: { resourceType: "organization", resourceId: cascadeOrg.id },
                    });
                    if (error) throw error;
                    toast.success("Organização excluída em cascata");
                    setCascadeOrg(null);
                    refetchOrgs();
                  } catch (err: any) {
                    toast.error(err?.message || "Erro ao excluir em cascata");
                  } finally {
                    setDeletingCascade(false);
                  }
                }}
                disabled={deletingCascade || confirmCascadeName !== cascadeOrg?.name}
              >
                Confirmar exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <EditOrganizationModal
          organization={null}
          open={createOrgOpen}
          onOpenChange={setCreateOrgOpen}
          onSuccess={() => refetchOrgs()}
        />
      </div>
    </AdminLayout>
  );
}
