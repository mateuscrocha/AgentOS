import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Building2, ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from "lucide-react";
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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
      notify.success("Status atualizado", "Dados salvos com sucesso.");
      refetchOrgs();
    },
    onError: () => {
      notify.error("Não foi possível concluir", "Algo deu errado. Tente novamente.");
    },
  });

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

  const getStatusLabel = (status: Organization["status"]) => {
    if (!status) return "Indefinida";
    if (status === "active") return "Ativa";
    if (status === "inactive") return "Inativa";
    if (status === "suspended") return "Suspensa";
    return status;
  };

  const renderStatusChip = (status: Organization["status"]) => (
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

  const columns = [
    {
      key: "name",
      header: "Organização",
      render: (org: Organization) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{org.name}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (org: Organization) => renderStatusChip(org.status),
    },
    {
      key: "groups_count",
      header: "Grupos",
      hideOn: "sm",
      render: (org: Organization) => (
        <Badge variant="secondary" className="tabular-nums">
          {orgGroupCounts?.[org.id] ?? 0}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Criada em",
      hideOn: "md",
      render: (org: Organization) => (
        <span className="text-xs text-muted-foreground tabular-nums">{formatDateSimpleBR(org.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right w-0",
      render: (org: Organization) => (
        <RowActions>
          <DropdownMenuItem
            onSelect={() => {
              navigate(`/org/${org.id}`);
            }}
          >
            Abrir
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              updateStatusMutation.mutate({
                id: org.id,
                status: org.status === "active" ? "inactive" : "active",
              })
            }
          >
            {org.status === "active" ? "Desativar" : "Reativar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setRemoveOrg(org)} className="text-destructive focus:text-destructive">
            Excluir
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setCascadeOrg(org);
              setConfirmCascadeName("");
            }}
            className="text-destructive focus:text-destructive"
          >
            Excluir com tudo
          </DropdownMenuItem>
        </RowActions>
      ),
    },
  ];

  const hasActiveFilters = !!search || statusFilter !== "all" || orderBy !== "name" || orderDir !== "asc";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setOrderBy("name");
    setOrderDir("asc");
    setPage(1);
  };

  const filterControlBase =
    "h-9 px-3 rounded-lg border border-border bg-background/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background";
  const filterSelectBase =
    "h-9 px-3 pr-8 rounded-lg border border-border bg-background/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background";

  const filtersForm = (
    <>
      <input
        type="text"
        placeholder="Buscar organização"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className={`${filterControlBase} w-full md:w-72`}
      />
      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value as any);
          setPage(1);
        }}
        className={`${filterSelectBase} w-full sm:w-auto min-w-[12rem]`}
        aria-label="Status"
      >
        <option value="all">Status: todos</option>
        <option value="active">Status: ativos</option>
        <option value="inactive">Status: inativos</option>
      </select>
      <select
        value={orderBy}
        onChange={(e) => setOrderBy(e.target.value as any)}
        className={`${filterSelectBase} w-full sm:w-auto min-w-[12rem]`}
        aria-label="Ordenar por"
      >
        <option value="name">Ordenar: nome</option>
        <option value="created_at">Ordenar: data</option>
      </select>
      <select
        value={orderDir}
        onChange={(e) => setOrderDir(e.target.value as any)}
        className={`${filterSelectBase} w-full sm:w-auto min-w-[12rem]`}
        aria-label="Direção"
      >
        <option value="asc">Direção: asc</option>
        <option value="desc">Direção: desc</option>
      </select>
    </>
  );

  return (
    <AdminLayout title="Organizações">
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Organizações</h2>
              <p className="text-sm text-muted-foreground">Gerencie quem usa o Bóris e seus grupos</p>
              <Breadcrumbs
                items={[{ label: "Central de Comando", href: "/" }, { label: "Organizações" }]}
                className="text-xs text-muted-foreground/80 [&_a]:text-muted-foreground/80 [&_a:hover]:text-foreground [&_span]:text-muted-foreground/80 [&_span]:font-normal"
              />
            </div>

            <Button onClick={() => setCreateOrgOpen(true)} size="lg" className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Nova organização
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Total</span>
            <Badge variant="secondary" className="tabular-nums">
              {typeof orgsData?.count === "number" ? orgsData.count.toLocaleString("pt-BR") : "—"}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="hidden md:flex flex-wrap items-center gap-2">{filtersForm}</div>

            <div className="md:hidden w-full">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full justify-between bg-background/60"
                onClick={() => setFiltersOpen(true)}
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtrar
                </span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                    Ativo
                  </Badge>
                )}
              </Button>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="hidden md:inline-flex">
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

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
                <Button type="button">Ver resultados</Button>
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
              title="Nenhuma organização por aqui"
              message="Quando você criar a primeira, ela vai aparecer nesta lista."
              action={{ label: "Nova organização", onClick: () => setCreateOrgOpen(true) }}
            />
          ) : (
            <div className="space-y-3">
              <ul className="space-y-3" role="list">
                {(orgsData?.items ?? []).map((org) => {
                  const groupsCount = orgGroupCounts?.[org.id] ?? 0;
                  return (
                    <li
                      key={org.id}
                      className="rounded-xl border border-border bg-card p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/org/${org.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/org/${org.id}`);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-card-foreground truncate">{org.name}</div>
                          <div className="mt-1">{renderStatusChip(org.status)}</div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {groupsCount} grupos · Criada em {formatDateSimpleBR(org.created_at)}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <RowActions>
                            <DropdownMenuItem onSelect={() => navigate(`/org/${org.id}`)}>Abrir</DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                updateStatusMutation.mutate({
                                  id: org.id,
                                  status: org.status === "active" ? "inactive" : "active",
                                })
                              }
                            >
                              {org.status === "active" ? "Desativar" : "Reativar"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => setRemoveOrg(org)}
                              className="text-destructive focus:text-destructive"
                            >
                              Excluir
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setCascadeOrg(org);
                                setConfirmCascadeName("");
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              Excluir com tudo
                            </DropdownMenuItem>
                          </RowActions>
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
            emptyMessage="Ainda não há organizações por aqui."
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
                Excluir
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
                      notify.error("Acesso negado", "Apenas admins do sistema podem excluir com tudo.");
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
                Excluir com tudo
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
