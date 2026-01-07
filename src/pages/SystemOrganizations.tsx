import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { Building2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
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
import { notify } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";
import { Badge } from "@/components/ui/badge";

interface Organization {
  id: string;
  name: string;
  status: string;
  created_at: string;
  stripe_customer_id?: string | null;
}

const PAGE_SIZE = 10;

function formatCounts(counts?: Record<string, number>): string {
  if (!counts) return "";
  const entries = Object.entries(counts)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${v}`);
  return entries.length ? entries.join(" • ") : "";
}

async function parseInvokeError(err: any): Promise<{ message: string; code?: string; counts?: Record<string, number> }> {
  let message = err?.message || "Algo deu errado. Tente novamente.";
  let code: string | undefined;
  let counts: Record<string, number> | undefined;

  if (err instanceof FunctionsHttpError && (err as any).context) {
    try {
      const body = await (err as any).context.json();
      if (body?.message) message = body.message;
      if (typeof body?.code === "string") code = body.code;
      if (body?.details?.counts && typeof body.details.counts === "object") counts = body.details.counts;
    } catch (_e) {
      void 0;
    }
  }

  return { message, code, counts };
}

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
        .select("id, name, status, created_at, stripe_customer_id", { count: "exact" });

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
      notify.success("Status atualizado", "Dados salvos com sucesso.");
      refetchOrgs();
    },
    onError: () => {
      notify.error("Não foi possível concluir", "Algo deu errado. Tente novamente.");
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

  const getStatusLabel = (status: Organization["status"]) => {
    if (!status) return "Indefinida";
    if (status === "active") return "Ativa";
    if (status === "inactive") return "Inativa";
    if (status === "suspended") return "Suspensa";
    return status;
  };

  const columns = [
    { key: "name", header: "Nome" },
    {
      key: "status",
      header: "Status",
      render: (org: Organization) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          org.status === "active"
            ? "bg-success/10 text-success"
            : org.status === "inactive"
              ? "bg-muted text-muted-foreground"
              : "bg-destructive/10 text-destructive"
        }`}>
          {getStatusLabel(org.status)}
        </span>
      ),
    },
    {
      key: "stripe",
      header: "Stripe",
      render: (org: Organization) =>
        org.stripe_customer_id ? (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5" title={org.stripe_customer_id}>
            Stripe
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "groups_count",
      header: "Grupos",
      hideOn: "sm",
      render: (org: Organization) => (
        <span className="text-sm text-muted-foreground">{orgGroupCounts?.[org.id] ?? 0}</span>
      ),
    },
    {
      key: "created_at",
      header: "Criado em",
      hideOn: "md",
      render: (org: Organization) => formatDateSimpleBR(org.created_at),
    },
    {
      key: "actions",
      header: "",
      className: "text-right w-0",
      render: (org: Organization) => (
        <RowActions>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/org/${org.id}`); }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Abrir organização
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: org.id, status: org.status === "active" ? "inactive" : "active" }); }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            {org.status === "active" ? "Desativar" : "Reativar"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setRemoveOrg(org); }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Excluir
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCascadeOrg(org); setConfirmCascadeName(""); }}
            className="w-full text-left px-2 py-1.5 text-sm text-destructive"
          >
            Excluir em cascata
          </button>
        </RowActions>
      ),
    },
  ];

  return (
    <AdminLayout title="Gerenciar organizações" subtitle="Central de Comando › Organizações">
      <div className="space-y-6 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Organizações" }]}
          title="Organizações"
          description="Gerenciar organizações do sistema"
          actions={(
            <Button onClick={() => setCreateOrgOpen(true)}>
              Nova organização
            </Button>
          )}
          filters={(
            <div className="flex flex-wrap items-center gap-2">
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
          )}
          showClearFilters={!!search || statusFilter !== 'all' || orderBy !== 'name' || orderDir !== 'asc'}
          onClearFilters={() => { setSearch(""); setStatusFilter('all'); setOrderBy('name'); setOrderDir('asc'); setPage(1); }}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Total de organizações</span>
          <Badge variant="secondary" className="tabular-nums">
            {typeof orgsData?.count === "number" ? orgsData.count.toLocaleString("pt-BR") : "—"}
          </Badge>
        </div>

        <BorisTable
          columns={columns as any}
          data={orgsData?.items ?? []}
          keyExtractor={(org) => org.id}
          onRowClick={(org) => navigate(`/org/${org.id}`)}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={orgsData?.count}
          onPageChange={setPage}
          loading={orgsLoading}
          error={!!orgsError}
          onRetry={() => refetchOrgs()}
          emptyIcon={Building2}
          emptyMessage="Não há organizações cadastradas."
        />

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
                    notify.warning("Atenção", "Exclua os grupos antes de remover a organização.");
                    return;
                  }
                  setRemovingOrg(true);
                  try {
                    const { error } = await supabase
                      .from("organizations")
                      .delete()
                      .eq("id", removeOrg.id);
                    if (error) throw error;
                    notify.success("Organização excluída", "Tudo certo.");
                    setRemoveOrg(null);
                    refetchOrgs();
                  } catch (err: any) {
                    notify.error("Não foi possível concluir", "Algo deu errado. Tente novamente.");
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
                    notify.warning("Atenção", "O nome digitado não confere.");
                    return;
                  }
                  setDeletingCascade(true);
                  try {
                    const { error } = await supabase.functions.invoke("delete-resource-cascade", {
                      body: { resourceType: "organization", resourceId: cascadeOrg.id },
                    });
                    if (error) throw error;
                    notify.success("Organização excluída", "Tudo certo.");
                    setCascadeOrg(null);
                    refetchOrgs();
                  } catch (err: any) {
                    const parsed = await parseInvokeError(err);
                    const countsLabel = formatCounts(parsed.counts);
                    if (parsed.code === "DEPENDENCIES_EXIST") {
                      notify.warning("Dependências existentes", countsLabel || "Ainda há registros vinculados a esta organização.");
                      return;
                    }
                    if (parsed.code === "DEPENDENCY_CLEANUP_FAILED") {
                      notify.error("Falha na limpeza", countsLabel ? `${parsed.message} (${countsLabel})` : parsed.message);
                      return;
                    }
                    if (parsed.code === "FORBIDDEN" || /forbidden/i.test(parsed.message)) {
                      notify.error("Acesso negado", "Apenas admins do sistema podem excluir organizações em cascata.");
                      return;
                    }
                    if (parsed.code === "UNAUTHORIZED" || /unauthorized/i.test(parsed.message)) {
                      notify.error("Sessão expirada", "Faça login novamente.");
                      return;
                    }
                    notify.error("Não foi possível concluir", countsLabel ? `${parsed.message} (${countsLabel})` : parsed.message);
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
