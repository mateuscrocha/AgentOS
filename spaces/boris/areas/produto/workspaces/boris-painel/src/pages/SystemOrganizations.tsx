import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ArrowRight, Building2, ChevronLeft, ChevronRight, Loader2, Plus, SlidersHorizontal, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
import { Button } from "@/components/ui/button";
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
import { getBillingStatusMeta, getRelationshipTypeMeta } from "@/lib/crm-tag-meta";
import { cn } from "@/lib/utils";

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
  const [orderBy, setOrderBy] = useState<"activity_24h" | "name" | "created_at">("activity_24h");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");
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

  const { orgsQuery, overviewQuery, orgGroupCountsQuery, refreshAll } = useSystemOrganizations({
    isAuthenticated,
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    statusFilter: "all",
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

  const renderOrgActions = (org: OrganizationListItem) => {
    const isCascadePending = deletingCascadeOrgId === org.id;
    const actionsDisabled = isCascadePending;

    return (
      <RowActions>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/org/${org.id}`);
          }}
          disabled={actionsDisabled}
        >
          Abrir
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            setEditingOrg(org);
          }}
          disabled={actionsDisabled}
        >
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
          Ações destrutivas
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            setCascadeOrg(org);
            setConfirmCascadeName("");
          }}
          className="text-destructive focus:text-destructive"
          disabled={actionsDisabled}
        >
          Excluir organização
        </DropdownMenuItem>
      </RowActions>
    );
  };

  const columns = [
    {
      key: "name",
      header: "Organização",
      sortable: true,
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
      key: "relationship_type",
      header: "Relacionamento",
      render: (org: OrganizationListItem) => {
        const meta = getRelationshipTypeMeta(org.relationship_type);
        return (
          <Badge variant="outline" className={meta.className}>
            {meta.label}
          </Badge>
        );
      },
    },
    {
      key: "billing_status",
      header: "Billing",
      render: (org: OrganizationListItem) => {
        const meta = getBillingStatusMeta(org.billing_status);
        return (
          <Badge variant="outline" className={meta.className}>
            {meta.label}
          </Badge>
        );
      },
    },
    {
      key: "activity_24h",
      header: "Atividade (24h)",
      sortable: true,
      render: (org: OrganizationListItem) => {
        const count = org.activity_24h ?? 0;
        return (
          <span className={count > 0 ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground"}>
            {count.toLocaleString("pt-BR")} msg{count === 1 ? "" : "s"}
          </span>
        );
      },
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
      sortable: true,
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

  const hasActiveFilters = !!search || orderBy !== "activity_24h" || orderDir !== "desc";
  const activeFiltersCount = Number(!!search) + Number(orderBy !== "activity_24h" || orderDir !== "desc");
  const sortValue = `${orderBy}:${orderDir}`;
  const visibleItems = orgsData?.items ?? [];
  const visibleActivity24h = visibleItems.reduce((sum, org) => sum + (org.activity_24h ?? 0), 0);
  const averageGroupsPerOrg = overview?.orgsTotal ? (overview.groupsTotal ?? 0) / Math.max(overview.orgsTotal, 1) : 0;
  const sortLabel = (() => {
    if (orderBy === "activity_24h" && orderDir === "desc") return "";
    if (orderBy === "activity_24h" && orderDir === "asc") return "Ordenação: menos atividade nas últimas 24h";
    if (orderBy === "name" && orderDir === "asc") return "";
    if (orderBy === "name" && orderDir === "desc") return "Ordenação: nome (Z-A)";
    if (orderBy === "created_at" && orderDir === "desc") return "Ordenação: mais recentes";
    if (orderBy === "created_at" && orderDir === "asc") return "Ordenação: mais antigas";
    return "Ordenação personalizada";
  })();

  const clearFilters = () => {
    setSearch("");
    setOrderBy("activity_24h");
    setOrderDir("desc");
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
        value={sortValue}
        onValueChange={(v) => {
          const [nextOrderBy, nextOrderDir] = v.split(":") as ["activity_24h" | "name" | "created_at", "asc" | "desc"];
          setOrderBy(nextOrderBy);
          setOrderDir(nextOrderDir);
          setPage(1);
        }}
      >
        <SelectTrigger className="h-9 w-full sm:w-auto min-w-[14rem] bg-background/60" aria-label="Ordenação">
          <SelectValue placeholder="Ordenação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="activity_24h:desc">Ordenar: mais ativas (24h)</SelectItem>
          <SelectItem value="activity_24h:asc">Ordenar: menos ativas (24h)</SelectItem>
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
      <div className="mx-auto max-w-[1480px] space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Organizações" }]}
          title="Organizações"
          description="Visão operacional das organizações que usam o Bóris, com foco nos indicadores principais e na lista de gestão."
          actions={(
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button variant="outline" onClick={() => void refreshOrganizationsData()}>
                Atualizar dados
              </Button>
              <Button onClick={() => setCreateOrgOpen(true)} size="lg" className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Nova organização
              </Button>
            </div>
          )}
          generalKpis={(
            <>
              <div className="rounded-[24px] border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,1))] p-4 shadow-[0_18px_40px_-30px_rgba(120,53,15,0.22)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">Organizações</div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{overview?.orgsTotal?.toLocaleString("pt-BR") ?? "—"}</div>
                <div className="mt-2 text-sm text-slate-600">base total cadastrada</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.12)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <Users className="h-3.5 w-3.5 text-amber-600" />
                  Grupos
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{overview?.groupsTotal?.toLocaleString("pt-BR") ?? "—"}</div>
                <div className="mt-2 text-sm text-slate-600">vinculados a organizações</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.12)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <Building2 className="h-3.5 w-3.5 text-amber-600" />
                  Média de grupos
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{averageGroupsPerOrg.toFixed(1).replace(".", ",")}</div>
                <div className="mt-2 text-sm text-slate-600">por organização</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.12)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <Users className="h-3.5 w-3.5 text-amber-600" />
                  Atividade 24h
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{visibleActivity24h.toLocaleString("pt-BR")}</div>
                <div className="mt-2 text-sm text-slate-600">mensagens no recorte atual</div>
              </div>
            </>
          )}
        />
        <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-3 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.25)] sm:p-4">
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
                <Badge variant="secondary" className="h-6 border-amber-200 bg-amber-50 px-2.5 text-[11px] text-amber-900">
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
                ...(sortLabel
                  ? [{
                      key: "sort",
                      label: sortLabel,
                      onRemove: () => {
                        setOrderBy("activity_24h");
                        setOrderDir("desc");
                        setPage(1);
                      },
                      ariaLabel: "Remover ordenação personalizada",
                    }]
                  : []),
              ]}
            />
          ) : null}
        </div>

        <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DrawerContent className="border-slate-200 bg-white">
            <DrawerHeader className="text-left">
              <DrawerTitle>Filtrar organizações</DrawerTitle>
              <DrawerDescription>Encontre mais rápido usando busca e ordenação.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-2">
              <div className="grid gap-3">{filtersForm}</div>
            </div>
            <DrawerFooter>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
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
                <div key={i} className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-4 shadow-subtle">
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
                  const activity24h = org.activity_24h ?? 0;
                  const relationshipMeta = getRelationshipTypeMeta(org.relationship_type);
                  const billingMeta = getBillingStatusMeta(org.billing_status);
                  const nextActionLabel =
                    groupsCount === 0
                      ? "Conectar o primeiro grupo"
                      : org.billing_status === "past_due" || org.billing_status === "unpaid" || org.billing_status === "overdue"
                        ? "Revisar billing antes de tudo"
                        : activity24h > 0
                          ? "Abrir a operação desta organização"
                          : "Revisar grupos e contato principal";
                  return (
                    <li key={org.id} className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_24px_44px_-34px_rgba(120,53,15,0.35)]">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          to={`/org/${org.id}`}
                          className="min-w-0 flex-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label={`Abrir organização ${org.name}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-semibold tracking-[-0.025em] text-slate-950 hover:underline">{org.name}</div>
                            {activity24h > 0 ? (
                              <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/10 px-2.5 text-[11px] font-semibold text-emerald-700">
                                {activity24h.toLocaleString("pt-BR")} msg / 24h
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={relationshipMeta.className}>
                              {relationshipMeta.label}
                            </Badge>
                            <Badge variant="outline" className={billingMeta.className}>
                              {billingMeta.label}
                            </Badge>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Grupos</div>
                              <div className="mt-1 text-sm font-semibold text-slate-950">{groupsCount.toLocaleString("pt-BR")}</div>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Criada em</div>
                              <div className="mt-1 text-sm font-semibold text-slate-950">{formatDateSimpleBR(org.created_at)}</div>
                            </div>
                          </div>
                          <div className="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">Próxima ação</div>
                            <div className="mt-1 text-sm font-medium text-slate-950">{nextActionLabel}</div>
                          </div>
                          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                            <span>Abrir organização</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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
                <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-slate-200 bg-white px-4 py-3 shadow-subtle">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {Math.max(1, Math.ceil(orgsData.count / PAGE_SIZE))}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
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
          <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.28)]">
            <div className="border-b border-slate-200/80 px-5 py-4 sm:px-6">
              <ListSectionHeader
                title="Lista de organizações"
                count={typeof orgsData?.count === "number" ? orgsData.count.toLocaleString("pt-BR") : "—"}
                statusLabel={hasActiveFilters ? ADMIN_MICROCOPY.listStatus.filtered : ADMIN_MICROCOPY.listStatus.allRecords}
                isLoading={orgsFetching}
                loadingIndicator={<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
              />
            </div>
            <div className={cn(orgsFetching && !orgsLoading ? "opacity-80 transition-opacity" : undefined)}>
              <BorisTable
                columns={columns as any}
                data={orgsData?.items ?? []}
                keyExtractor={(org) => org.id}
                onRowClick={(org) => navigate(`/org/${org.id}`)}
                rowHref={(org) => `/org/${org.id}`}
                page={page}
                pageSize={PAGE_SIZE}
                totalCount={orgsData?.count}
                onPageChange={setPage}
                loading={orgsLoading}
                error={!!orgsError}
                onRetry={() => refetchOrgs()}
                sortMode="manual"
                sortState={{ key: orderBy, direction: orderDir }}
                onSortChange={(sort) => {
                  if (!sort || (sort.key !== "activity_24h" && sort.key !== "name" && sort.key !== "created_at")) return;
                  setOrderBy(sort.key as "activity_24h" | "name" | "created_at");
                  setOrderDir(sort.direction);
                  setPage(1);
                }}
                emptyIcon={Building2}
                emptyMessage={
                  hasActiveFilters
                    ? "Nenhuma organização encontrada com os filtros atuais."
                    : "Ainda não há organizações por aqui."
                }
              />
            </div>
          </div>
        </div>

        <AlertDialog open={!!cascadeOrg} onOpenChange={(open) => !open && setCascadeOrg(null)}>
          <AlertDialogContent className="border-slate-200 bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir organização</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Isso remove a organização, seus grupos e dados associados.
                Para confirmar, digite o nome da organização.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <label htmlFor="confirm-cascade-name" className="text-sm font-medium text-card-foreground">
                Digite o nome da organização para confirmar
              </label>
              <Input
                id="confirm-cascade-name"
                type="text"
                value={confirmCascadeName}
                onChange={(e) => setConfirmCascadeName(e.target.value)}
                placeholder={cascadeOrg?.name || "Nome da organização"}
                className="w-full"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2" onClick={() => setCascadeOrg(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!cascadeOrg) return;
                  if (confirmCascadeName.trim() !== cascadeOrg.name.trim()) {
                    notify.warning("Confirmação inválida", "O nome digitado não confere.");
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
                      notify.error("Acesso negado", "Apenas admins do sistema podem excluir organizações.");
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
                {deletingCascadeOrgId === cascadeOrg?.id ? "Excluindo..." : "Excluir"}
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
