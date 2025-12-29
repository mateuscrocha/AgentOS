import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Building2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, PeriodType, DateRange } from "@/components/group-dashboard/period-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
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

  const currentRange = getDateRange(selectedPeriod, customRange);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();

  const { data: orgsData, isLoading: orgsLoading, error: orgsError, refetch: refetchOrgs } = useQuery({
    queryKey: ["system-organizations", page, debouncedSearch, statusFilter, orderBy, orderDir, selectedPeriod, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("organizations")
        .select("id, name, status, created_at", { count: "exact" })
        .gte("created_at", currentStartISO)
        .lte("created_at", currentEndISO);

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
              <PeriodFilter
                value={selectedPeriod}
                customRange={customRange}
                onChange={(p, r) => { setSelectedPeriod(p); setCustomRange(p === 'custom' ? r : undefined); setPage(1); }}
              />
              <input
                type="text"
                placeholder="Buscar por nome"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-64 px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={orderBy} onValueChange={(v) => setOrderBy(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Ordenar por Nome</SelectItem>
                  <SelectItem value="created_at">Ordenar por Data</SelectItem>
                </SelectContent>
              </Select>
              <Select value={orderDir} onValueChange={(v) => setOrderDir(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Direção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Asc</SelectItem>
                  <SelectItem value="desc">Desc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          showClearFilters={selectedPeriod !== '7d' || !!customRange || !!search || statusFilter !== 'all' || orderBy !== 'name' || orderDir !== 'asc'}
          onClearFilters={() => { setSelectedPeriod('7d'); setCustomRange(undefined); setSearch(""); setStatusFilter('all'); setOrderBy('name'); setOrderDir('asc'); setPage(1); }}
          filteredKpis={(
            <StatsCard
              title="Organizações no período"
              value={orgsData?.count ?? '—'}
              icon={Building2}
              variant="kpi"
            />
          )}
        />

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
                    notify.error("Não foi possível concluir", "Algo deu errado. Tente novamente.");
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
