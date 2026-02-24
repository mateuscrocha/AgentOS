import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Building2, ChevronLeft, ChevronRight, Loader2, Plus, SlidersHorizontal, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ExecutiveSectionHeader } from "@/components/dashboard/ExecutiveSectionHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
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
import { Link, useNavigate } from "react-router-dom";
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";
import { Badge } from "@/components/ui/badge";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterBarRow } from "@/components/ui/filter-bar-row";
import { FilterTriggerButton } from "@/components/ui/filter-trigger-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSystemOrganizations, type OrganizationListItem } from "@/hooks/use-system-organizations";

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

function parseDbError(err: any): { title: string; message: string } {
  const raw = String(err?.message || "");
  const code = String(err?.code || "");

  if (code === "42501" || /policy|permission|forbidden/i.test(raw)) {
    return { title: "Sem permissão", message: "Você não tem permissão para concluir esta ação." };
  }

  if (/foreign key|violates foreign key/i.test(raw)) {
    return { title: "Dependências existentes", message: "Existem registros vinculados a esta organização." };
  }

  return { title: "Não foi possível concluir", message: raw || "Algo deu errado. Tente novamente." };
}

export default function SystemOrganizations() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "suspended">("all");
  const [orderBy, setOrderBy] = useState<"name" | "created_at">("name");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
  const [removeOrg, setRemoveOrg] = useState<OrganizationListItem | null>(null);
  const [removingOrgId, setRemovingOrgId] = useState<string | null>(null);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationListItem | null>(null);
  const [cascadeOrg, setCascadeOrg] = useState<OrganizationListItem | null>(null);
  const [confirmCascadeName, setConfirmCascadeName] = useState("");
  const [deletingCascadeOrgId, setDeletingCascadeOrgId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { orgsQuery, overviewQuery, orgGroupCountsQuery, updateStatusMutation, refreshAll } = useSystemOrganizations({
    isAuthenticated,
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    statusFilter,
    orderBy,
    orderDir,
  });
  const { data: orgsData, isLoading: orgsLoading, isFetching: orgsFetching, error: orgsError, refetch: refetchOrgs } = orgsQuery;
  const { data: overview, isLoading: overviewLoading } = overviewQuery;
  const { data: orgGroupCounts } = orgGroupCountsQuery;

  useEffect(() => {
    const count = orgsData?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [orgsData?.count, page]);

  const refreshOrganizationsData = refreshAll;

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Organizações" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const getStatusLabel = (status: OrganizationListItem["status"]) => {
    if (!status) return "Indefinida";
    if (status === "active") return "Ativa";
    if (status === "inactive") return "Inativa";
    if (status === "suspended") return "Suspensa";
    return status;
  };

  const renderStatusChip = (status: OrganizationListItem["status"]) => (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        status === "active"
          ? "bg-success/10 text-success"
          : status === "inactive"
            ? "bg-muted text-muted-foreground"
            : "bg-destructive/10 text-destructive"
      }`}
    >
      {getStatusLabel(status)}
    </span>
  );

  const pendingStatusOrgId = (updateStatusMutation.isPending ? (updateStatusMutation.variables as any)?.id : null) as string | null;

  const renderOrgActions = (org: OrganizationListItem) => {
    const isStatusPending = pendingStatusOrgId === org.id;
    const isDeletePending = removingOrgId === org.id;
    const isCascadePending = deletingCascadeOrgId === org.id;
    const actionsDisabled = isStatusPending || isDeletePending || isCascadePending;
    const groupsCount = orgGroupCounts?.[org.id] ?? 0;
    const canSimpleDelete = groupsCount === 0;

    return (
      <RowActions>
        <DropdownMenuItem onSelect={() => navigate(`/org/${org.id}`)} disabled={actionsDisabled}>
          Abrir
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setEditingOrg(org)} disabled={actionsDisabled}>
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            try {
              await updateStatusMutation.mutateAsync({
                id: org.id,
                status: org.status === "active" ? "inactive" : "active",
              });
              notify.success("Status atualizado", "Dados salvos com sucesso.");
              await refreshOrganizationsData();
            } catch (err: any) {
              const parsed = parseDbError(err);
              notify.error(parsed.title, parsed.message);
            }
          }}
          disabled={actionsDisabled}
        >
          {isStatusPending ? "Salvando..." : org.status === "active" ? "Desativar" : "Reativar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
          Ações destrutivas
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => setRemoveOrg(org)}
          className="text-destructive focus:text-destructive"
          disabled={actionsDisabled || !canSimpleDelete}
        >
          {canSimpleDelete ? "Excluir" : "Excluir (remova grupos antes)"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setCascadeOrg(org);
            setConfirmCascadeName("");
          }}
          className="text-destructive focus:text-destructive"
          disabled={actionsDisabled}
        >
          Excluir organização e dados
        </DropdownMenuItem>
      </RowActions>
    );
  };

  const columns = [
    {
      key: "name",
      header: "Organização",
      render: (org: OrganizationListItem) => (
        <div className="min-w-0">
          <Link
            to={`/org/${org.id}`}
            className="font-semibold text-card-foreground truncate hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {org.name}
          </Link>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (org: OrganizationListItem) => renderStatusChip(org.status),
    },
    {
      key: "groups_count",
      header: "Grupos",
      hideOn: "sm",
      render: (org: OrganizationListItem) => (
        <Badge variant="secondary" className="tabular-nums">
          {orgGroupCounts?.[org.id] ?? 0}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Criada em",
      hideOn: "md",
      render: (org: OrganizationListItem) => (
        <span className="text-xs text-muted-foreground tabular-nums">{formatDateSimpleBR(org.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right w-0",
      render: (org: OrganizationListItem) => renderOrgActions(org),
    },
  ];

  const hasActiveFilters = !!search || statusFilter !== "all" || orderBy !== "name" || orderDir !== "asc";
  const activeFiltersCount = Number(!!search) + Number(statusFilter !== "all") + Number(orderBy !== "name" || orderDir !== "asc");
  const sortValue = `${orderBy}:${orderDir}`;
  const sortLabel = (() => {
    if (orderBy === "name" && orderDir === "asc") return "";
    if (orderBy === "name" && orderDir === "desc") return "Ordenação: nome (Z-A)";
    if (orderBy === "created_at" && orderDir === "desc") return "Ordenação: mais recentes";
    if (orderBy === "created_at" && orderDir === "asc") return "Ordenação: mais antigas";
    return "Ordenação personalizada";
  })();

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setOrderBy("name");
    setOrderDir("asc");
    setPage(1);
  };

  const filtersForm = (
    <>
      <div className="relative w-full md:w-72">
        <Input
          type="text"
          placeholder="Buscar organização"
          aria-label="Buscar organização por nome"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 w-full pr-10 bg-background/60"
        />
        {search !== debouncedSearch && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      <Select
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v as any);
          setPage(1);
        }}
      >
        <SelectTrigger className="h-9 w-full sm:w-auto min-w-[12rem] bg-background/60" aria-label="Status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Status: todos</SelectItem>
          <SelectItem value="active">Status: ativos</SelectItem>
          <SelectItem value="inactive">Status: inativos</SelectItem>
          <SelectItem value="suspended">Status: suspensos</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={sortValue}
        onValueChange={(v) => {
          const [nextOrderBy, nextOrderDir] = v.split(":") as ["name" | "created_at", "asc" | "desc"];
          setOrderBy(nextOrderBy);
          setOrderDir(nextOrderDir);
          setPage(1);
        }}
      >
        <SelectTrigger className="h-9 w-full sm:w-auto min-w-[14rem] bg-background/60" aria-label="Ordenação">
          <SelectValue placeholder="Ordenação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name:asc">Ordenar: nome (A-Z)</SelectItem>
          <SelectItem value="name:desc">Ordenar: nome (Z-A)</SelectItem>
          <SelectItem value="created_at:desc">Ordenar: mais recentes</SelectItem>
          <SelectItem value="created_at:asc">Ordenar: mais antigas</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <AdminLayout title="Organizações" subtitle="Gerencie quem usa o Bóris e seus grupos">
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <Breadcrumbs
                items={[{ label: "Central de Comando", href: "/" }, { label: "Organizações" }]}
                className="text-xs text-muted-foreground/80 [&_a]:text-muted-foreground/80 [&_a:hover]:text-foreground [&_span]:text-muted-foreground/80 [&_span]:font-normal"
              />
              <ExecutiveSectionHeader
                eyebrow="Base de clientes"
                title="Organizações"
                description="Cadastros, status e estrutura de grupos das organizações que usam o Bóris."
                icon={Building2}
                className="mb-0"
                badge={(
                  <Badge variant="outline" className="h-6 border-primary/20 bg-primary/[0.04] px-2 text-[11px] font-medium text-primary/85">
                    Visão de sistema
                  </Badge>
                )}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{hasActiveFilters ? "Resultados" : "Base total"}</span>
                <Badge variant="secondary" className="tabular-nums">
                  {typeof orgsData?.count === "number" ? orgsData.count.toLocaleString("pt-BR") : "—"}
                </Badge>
                {orgsFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : null}
              </div>
            </div>

            <Button onClick={() => setCreateOrgOpen(true)} size="lg" className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Nova organização
            </Button>
          </div>

          <div className="grid max-w-2xl gap-3 grid-cols-1 sm:grid-cols-2">
            <StatsCard
              title="Total"
              value={overview?.orgsTotal?.toLocaleString("pt-BR") ?? "—"}
              icon={Building2}
              variant="kpi"
              isLoading={overviewLoading}
              numericValue
              help={{
                whatIs: "Quantidade total de organizações cadastradas no sistema.",
                howToInterpret: "Mostra o tamanho da base de clientes/organizações na plataforma.",
                whatToObserve: "Compare com ‘Grupos’ para acompanhar crescimento de estrutura por organização.",
              }}
            />
            <StatsCard
              title="Grupos"
              value={overview?.groupsTotal?.toLocaleString("pt-BR") ?? "—"}
              icon={Users}
              variant="kpi"
              isLoading={overviewLoading}
              numericValue
              help={{
                whatIs: "Total de grupos vinculados às organizações cadastradas.",
                howToInterpret: "Mostra a escala operacional distribuída entre as organizações.",
                whatToObserve: "Mudanças bruscas podem refletir criação/remoção em lote ou ajustes de vínculo.",
              }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
          <FilterBarRow
            desktopFilters={filtersForm}
            mobileTrigger={(
              <FilterTriggerButton
                onClick={() => setFiltersOpen(true)}
                icon={SlidersHorizontal}
                activeCount={hasActiveFilters ? activeFiltersCount : undefined}
                countLabel={`${activeFiltersCount} filtro${activeFiltersCount > 1 ? "s" : ""}`}
              />
            )}
            rightActions={hasActiveFilters ? (
              <>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  {activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""} ativo{activeFiltersCount > 1 ? "s" : ""}
                </Badge>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </>
            ) : null}
          />

          {hasActiveFilters ? (
            <FilterChips
              className="mt-3"
              items={[
                ...(search
                  ? [{
                      key: "search",
                      label: `Busca: ${search}`,
                      onRemove: () => {
                        setSearch("");
                        setPage(1);
                      },
                      ariaLabel: "Remover filtro de busca",
                    }]
                  : []),
                ...(statusFilter !== "all"
                  ? [{
                      key: "status",
                      label: `Status: ${statusFilter === "active" ? "ativas" : statusFilter === "inactive" ? "inativas" : "suspensas"}`,
                      onRemove: () => {
                        setStatusFilter("all");
                        setPage(1);
                      },
                      ariaLabel: "Remover filtro de status",
                    }]
                  : []),
                ...(sortLabel
                  ? [{
                      key: "sort",
                      label: sortLabel,
                      onRemove: () => {
                        setOrderBy("name");
                        setOrderDir("asc");
                        setPage(1);
                      },
                      ariaLabel: "Remover ordenação personalizada",
                    }]
                  : []),
              ]}
            />
          ) : null}
        </div>

        <ListSectionHeader
          title="Lista de organizações"
          count={typeof orgsData?.count === "number" ? orgsData.count.toLocaleString("pt-BR") : "—"}
          statusLabel={hasActiveFilters ? ADMIN_MICROCOPY.listStatus.filtered : ADMIN_MICROCOPY.listStatus.allRecords}
          isLoading={orgsFetching}
          loadingIndicator={<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
        />

        <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DrawerContent className="bg-card border-border">
            <DrawerHeader className="text-left">
              <DrawerTitle>Filtrar organizações</DrawerTitle>
              <DrawerDescription>Encontre mais rápido usando busca, status e ordenação.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-2">
              <div className="grid gap-3">{filtersForm}</div>
            </div>
            <DrawerFooter>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    clearFilters();
                    setFiltersOpen(false);
                  }}
                >
                  Limpar filtros
                </Button>
              )}
              <DrawerClose asChild>
                <Button type="button">Fechar</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <div className="md:hidden">
          {orgsLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-56" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : orgsError ? (
            <ErrorState
              title="Não foi possível carregar as organizações"
              message="Tente novamente em alguns instantes."
              retry={() => refetchOrgs()}
            />
          ) : !orgsData?.items?.length ? (
            <EmptyState
              icon={Building2}
              title={hasActiveFilters ? "Nenhum resultado encontrado" : "Nenhuma organização por aqui"}
              message={
                hasActiveFilters
                  ? "Tente ajustar os filtros para encontrar outras organizações."
                  : "Quando você criar a primeira, ela vai aparecer nesta lista."
              }
              action={
                hasActiveFilters
                  ? { label: "Limpar filtros", onClick: clearFilters }
                  : { label: "Nova organização", onClick: () => setCreateOrgOpen(true) }
              }
            />
          ) : (
            <div className="space-y-3">
              <ul className="space-y-3" role="list">
                {(orgsData?.items ?? []).map((org) => {
                  const groupsCount = orgGroupCounts?.[org.id] ?? 0;
                  return (
                    <li key={org.id} className="rounded-xl border border-border bg-card p-4 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          to={`/org/${org.id}`}
                          className="min-w-0 flex-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label={`Abrir organização ${org.name}`}
                        >
                          <div className="text-base font-semibold text-card-foreground truncate hover:underline">{org.name}</div>
                          <div className="mt-1">{renderStatusChip(org.status)}</div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {groupsCount} grupos · Criada em {formatDateSimpleBR(org.created_at)}
                          </div>
                        </Link>

                        <div className="shrink-0">
                          {renderOrgActions(org)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {typeof orgsData?.count === "number" && orgsData.count > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {Math.max(1, Math.ceil(orgsData.count / PAGE_SIZE))}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= Math.ceil(orgsData.count / PAGE_SIZE)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden md:block">
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
            emptyMessage={
              hasActiveFilters
                ? "Nenhuma organização encontrada com os filtros atuais."
                : "Ainda não há organizações por aqui."
            }
          />
        </div>

        <AlertDialog open={!!removeOrg} onOpenChange={(open) => !open && setRemoveOrg(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir organização</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é definitiva. Se existirem grupos ligados a esta organização, a exclusão será bloqueada.
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
                  setRemovingOrgId(removeOrg.id);
                  try {
                    const { error } = await supabase
                      .from("organizations")
                      .delete()
                      .eq("id", removeOrg.id);
                    if (error) throw error;
                    notify.success("Organização excluída", "Tudo certo.");
                    setRemoveOrg(null);
                    await refreshOrganizationsData();
                  } catch (err: any) {
                    const parsed = parseDbError(err);
                    notify.error(parsed.title, parsed.message);
                  } finally {
                    setRemovingOrgId(null);
                  }
                }}
                disabled={removingOrgId === removeOrg?.id}
              >
                {removingOrgId === removeOrg?.id ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!cascadeOrg} onOpenChange={(open) => !open && setCascadeOrg(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir com tudo</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Isso remove a organização, seus grupos e dados associados.
                Para confirmar, digite o nome da organização.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <label htmlFor="confirm-cascade-name" className="text-sm font-medium text-card-foreground">
                Digite o nome da organização para confirmar
              </label>
              <input
                id="confirm-cascade-name"
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
                  if (confirmCascadeName.trim() !== cascadeOrg.name.trim()) {
                    notify.warning("Atenção", "O nome digitado não confere.");
                    return;
                  }
                  setDeletingCascadeOrgId(cascadeOrg.id);
                  try {
                    const { error } = await supabase.functions.invoke("delete-resource-cascade", {
                      body: { resourceType: "organization", resourceId: cascadeOrg.id },
                    });
                    if (error) throw error;
                    notify.success("Organização excluída", "Tudo certo.");
                    setCascadeOrg(null);
                    await refreshOrganizationsData();
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
                      notify.error("Acesso negado", "Apenas admins do sistema podem excluir com tudo.");
                      return;
                    }
                    if (parsed.code === "UNAUTHORIZED" || /unauthorized/i.test(parsed.message)) {
                      notify.error("Sessão expirada", "Faça login novamente.");
                      return;
                    }
                    notify.error("Não foi possível concluir", countsLabel ? `${parsed.message} (${countsLabel})` : parsed.message);
                  } finally {
                    setDeletingCascadeOrgId(null);
                  }
                }}
                disabled={
                  deletingCascadeOrgId === cascadeOrg?.id ||
                  confirmCascadeName.trim() !== (cascadeOrg?.name ?? "").trim()
                }
              >
                {deletingCascadeOrgId === cascadeOrg?.id ? "Excluindo..." : "Excluir com tudo"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <EditOrganizationModal
          organization={editingOrg}
          open={!!editingOrg}
          onOpenChange={(open) => {
            if (!open) setEditingOrg(null);
          }}
          onSuccess={() => {
            void refreshOrganizationsData();
          }}
        />

        <EditOrganizationModal
          organization={null}
          open={createOrgOpen}
          onOpenChange={setCreateOrgOpen}
          onSuccess={() => {
            void refreshOrganizationsData();
          }}
        />
      </div>
    </AdminLayout>
  );
}
