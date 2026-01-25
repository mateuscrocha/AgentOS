import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { Badge } from "@/components/ui/badge";
import { StatusTag } from "@/components/ui/status-tag";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { formatDateSimpleBR, formatDateTickBR } from "@/lib/date";

interface GroupRow {
  id: string;
  name: string;
  provider: string;
  status: string | null;
  organization_id: string;
  organizations?: { name: string } | null;
  invite_link?: string | null;
  created_at?: string;
  last_access_at?: string | null;
  members_count?: number;
}

interface OrganizationOption { id: string; name: string; }

const PAGE_SIZE = 10;

async function parseInvokeError(err: any): Promise<{ message: string; code?: string }> {
  let message = err?.message || "Algo deu errado. Tente novamente.";
  let code: string | undefined;

  if (err instanceof FunctionsHttpError && (err as any).context) {
    try {
      const body = await (err as any).context.json();
      if (body?.message) message = body.message;
      if (typeof body?.code === "string") code = body.code;
    } catch (_e) {
      void 0;
    }
  }

  const isFetchError =
    err instanceof FunctionsFetchError ||
    err?.name === "FunctionsFetchError" ||
    /failed to send a request to the edge function/i.test(message) ||
    /fetch failed/i.test(message) ||
    /networkerror/i.test(message);

  if (!code && isFetchError) {
    const isOffline = typeof navigator !== "undefined" && navigator?.onLine === false;
    code = "NETWORK_ERROR";
    message = isOffline
      ? "Sem conexão com a internet."
      : "Não foi possível comunicar com o servidor. Verifique sua conexão/VPN e tente novamente.";
  }

  return { message, code };
}

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
  const [editInviteGroup, setEditInviteGroup] = useState<GroupRow | null>(null);
  const [inviteLinkInput, setInviteLinkInput] = useState("");
  const [cascadeGroup, setCascadeGroup] = useState<GroupRow | null>(null);
  const [deletingCascade, setDeletingCascade] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
        .select("id, name, provider, status, organization_id, invite_link, created_at, organizations(name)", { count: "exact" });

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

      const items = (data ?? []) as GroupRow[];
      const groupIds = items.map((g) => g.id).filter(Boolean);
      if (groupIds.length) {
        const { data: overviewData, error: overviewErr } = await supabase
          .from("v_group_overview")
          .select("group_id, last_access_at, members_count")
          .in("group_id", groupIds);
        if (!overviewErr && Array.isArray(overviewData)) {
          const byId = new Map<string, any>();
          overviewData.forEach((row: any) => {
            if (row?.group_id) byId.set(row.group_id, row);
          });
          items.forEach((g) => {
            const o = byId.get(g.id);
            if (!o) return;
            g.last_access_at = o.last_access_at;
            g.members_count = typeof o.members_count === "number" ? o.members_count : Number(o.members_count ?? 0);
          });
        }
      }

      return { items, count: count ?? 0 };
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
      notify.success("Status atualizado", "Dados salvos com sucesso.");
      refetch();
    },
    onError: (err: any) => {
      notify.error("Não foi possível atualizar status", "Algo deu errado. Tente novamente.");
    },
  });

  const updateInviteMutation = useMutation({
    mutationFn: async ({ id, invite_link }: { id: string; invite_link: string | null }) => {
      const { error } = await supabase
        .from("groups")
        .update({ invite_link })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Convite atualizado", "Dados salvos com sucesso.");
      setEditInviteGroup(null);
      setInviteLinkInput("");
      refetch();
    },
    onError: (err: any) => {
      notify.error("Não foi possível atualizar convite", "Algo deu errado. Tente novamente.");
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

  const hasActiveFilters = !!search || !!orgFilter || statusFilter !== "all" || orderBy !== "created_at" || orderDir !== "desc";

  const handleClearFilters = () => {
    setSearch("");
    setOrgFilter("");
    setStatusFilter("all");
    setOrderBy("created_at");
    setOrderDir("desc");
    setPage(1);
  };

  const getStatusLabel = (status: GroupRow["status"]) => {
    if (!status) return "Indefinido";
    if (status === "active") return "Ativo";
    if (status === "inactive") return "Inativo";
    if (status === "suspended") return "Suspenso";
    return status;
  };

  const getStatusVariant = (status: GroupRow["status"]) => {
    if (status === "active") return "success" as const;
    if (status === "suspended") return "error" as const;
    if (status === "inactive") return "neutral" as const;
    return "neutral" as const;
  };

  const getLastActivityTone = (value?: string | null): "quiet" | "attention" => {
    if (!value) return "attention";
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return "attention";
    const days = (Date.now() - t) / (1000 * 60 * 60 * 24);
    return days >= 30 ? "attention" : "quiet";
  };

  const renderGroupActions = (g: GroupRow) => (
    <RowActions>
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/groups/${g.id}`); }}
        className="w-full text-left px-2 py-1.5 text-sm"
      >
        Abrir grupo
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: g.id, status: g.status === "active" ? "inactive" : "active" }); }}
        className="w-full text-left px-2 py-1.5 text-sm"
      >
        {g.status === "active" ? "Desativar" : "Reativar"}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setEditInviteGroup(g); setInviteLinkInput(g.invite_link || ""); }}
        className="w-full text-left px-2 py-1.5 text-sm"
      >
        Editar convite
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setRemoveGroup(g); }}
        className="w-full text-left px-2 py-1.5 text-sm"
      >
        Arquivar
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setCascadeGroup(g); }}
        className="w-full text-left px-2 py-1.5 text-sm text-destructive"
      >
        Excluir grupo
      </button>
    </RowActions>
  );

  const columns = [
    {
      key: "name",
      header: "Grupo",
      render: (g: GroupRow) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{g.name || "—"}</div>
        </div>
      ),
    },
    {
      key: "organizations",
      header: "Organização",
      hideOn: "sm",
      render: (g: GroupRow) => (
        <span className="text-sm text-muted-foreground">{g.organizations?.name || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (g: GroupRow) => (
        <StatusTag variant={getStatusVariant(g.status)}>
          {getStatusLabel(g.status)}
        </StatusTag>
      ),
    },
    {
      key: "members_count",
      header: "Membros",
      hideOn: "sm",
      render: (g: GroupRow) => (
        <span className="tabular-nums text-sm font-semibold text-foreground">{typeof g.members_count === "number" ? g.members_count.toLocaleString("pt-BR") : "—"}</span>
      ),
    },
    {
      key: "created_at",
      header: "Criado",
      hideOn: "sm",
      render: (g: GroupRow) => (
        <span className="text-xs text-muted-foreground">{g.created_at ? formatDateSimpleBR(g.created_at) : "—"}</span>
      ),
    },
    {
      key: "last_access_at",
      header: "Última atividade",
      hideOn: "sm",
      render: (g: GroupRow) => {
        const tone = getLastActivityTone(g.last_access_at);
        const label = g.last_access_at ? formatDateSimpleBR(g.last_access_at) : "Sem atividade";
        return (
          <span className={tone === "attention" ? "text-sm font-medium text-warning" : "text-sm text-muted-foreground"}>
            {label}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right w-0",
      render: (g: GroupRow) => renderGroupActions(g),
    },
  ];

  return (
    <AdminLayout title="Grupos" subtitle="Todos os grupos conectados ao Bóris">
      <div className="space-y-6 animate-fade-in">
        <section className="space-y-4">
          <Breadcrumbs
            items={[{ label: "Central de Comando", href: "/" }, { label: "Grupos" }]}
            className="text-xs text-muted-foreground [&_span]:font-normal [&_span]:text-muted-foreground"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Grupos</h1>
              <p className="text-sm text-muted-foreground">Todos os grupos conectados ao Bóris</p>
            </div>

            <div className="shrink-0 flex items-center gap-2 sm:mt-1">
              <span className="hidden sm:inline text-xs text-muted-foreground">Grupos conectados</span>
              <Badge variant="secondary" className="tabular-nums">
                {typeof groupsData?.count === "number" ? groupsData.count.toLocaleString("pt-BR") : "—"}
              </Badge>
            </div>
          </div>

          <div className="rounded-2xl bg-secondary/20 p-3 sm:p-4">
            <div className="md:hidden flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filtrar
              </Button>

              {hasActiveFilters ? (
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={handleClearFilters}>
                  Limpar
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Refine para encontrar um grupo.</span>
              )}
            </div>

            <div className="hidden md:flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar por nome"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-9 w-72 px-3 rounded-lg border border-border/60 bg-background text-sm"
                />
                <select
                  value={orgFilter}
                  onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}
                  className="h-9 px-3 rounded-lg border border-border/60 bg-background text-sm"
                >
                  <option value="">Organização</option>
                  {(organizations ?? []).map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                  className="h-9 px-3 rounded-lg border border-border/60 bg-background text-sm"
                >
                  <option value="all">Status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>
                <select
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value as any)}
                  className="h-9 px-3 rounded-lg border border-border/60 bg-background text-sm"
                >
                  <option value="created_at">Criado</option>
                  <option value="name">Nome</option>
                </select>
                <select
                  value={orderDir}
                  onChange={(e) => setOrderDir(e.target.value as any)}
                  className="h-9 px-3 rounded-lg border border-border/60 bg-background text-sm"
                >
                  <option value="asc">Crescente</option>
                  <option value="desc">Decrescente</option>
                </select>
              </div>

              {hasActiveFilters && (
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={handleClearFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </section>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom" className="bg-card border-border">
            <SheetHeader className="text-left">
              <SheetTitle>Filtrar grupos</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Buscar por nome</div>
                <input
                  type="text"
                  placeholder="Ex: Comercial, Operações, Suporte…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-10 w-full px-3 rounded-lg border border-border bg-background text-sm"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Organização</div>
                <select
                  value={orgFilter}
                  onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}
                  className="h-10 w-full px-3 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="">Todas</option>
                  {(organizations ?? []).map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Status</div>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                    className="h-10 w-full px-3 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="all">Todos</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Direção</div>
                  <select
                    value={orderDir}
                    onChange={(e) => setOrderDir(e.target.value as any)}
                    className="h-10 w-full px-3 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="desc">Decrescente</option>
                    <option value="asc">Crescente</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Ordenar por</div>
                <select
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value as any)}
                  className="h-10 w-full px-3 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="created_at">Criado</option>
                  <option value="name">Nome</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={handleClearFilters} disabled={!hasActiveFilters}>
                  Limpar
                </Button>
                <Button type="button" onClick={() => setFiltersOpen(false)}>
                  Ver resultados
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="md:hidden">
          {isLoading ? (
            <LoadingState message="Carregando grupos..." />
          ) : error ? (
            <ErrorState message="Falha ao carregar grupos" retry={() => refetch()} />
          ) : (groupsData?.items ?? []).length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum grupo encontrado"
              message={hasActiveFilters ? "Ajuste a busca ou os filtros para ver resultados." : "Ainda não há grupos cadastrados."}
            />
          ) : (
            <div className="space-y-3">
              {(groupsData?.items ?? []).map((g) => {
                const membersLabel = typeof g.members_count === "number" ? g.members_count.toLocaleString("pt-BR") : "—";
                const lastActivityTone = getLastActivityTone(g.last_access_at);
                const lastActivityLabel = g.last_access_at ? `Última atividade em ${formatDateTickBR(g.last_access_at)}` : "Sem atividade registrada";

                return (
                  <div
                    key={g.id}
                    className="rounded-2xl bg-secondary/20 p-4 transition-colors cursor-pointer hover:bg-secondary/30"
                    onClick={() => navigate(`/groups/${g.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-foreground">{g.name || "—"}</div>
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">{g.organizations?.name || "—"}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <StatusTag variant={getStatusVariant(g.status)} className="hidden sm:inline-flex">
                          {getStatusLabel(g.status)}
                        </StatusTag>
                        {renderGroupActions(g)}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground tabular-nums">{membersLabel}</span>
                        <span> membros · </span>
                        <span className={lastActivityTone === "attention" ? "text-warning font-medium" : undefined}>
                          {lastActivityLabel}
                        </span>
                      </div>

                      <StatusTag variant={getStatusVariant(g.status)} className="sm:hidden">
                        {getStatusLabel(g.status)}
                      </StatusTag>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <BorisTable
            columns={columns as any}
            data={groupsData?.items ?? []}
            keyExtractor={(g) => g.id}
            onRowClick={(g) => navigate(`/groups/${g.id}`)}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={groupsData?.count}
            onPageChange={setPage}
            loading={isLoading}
            error={!!error}
            onRetry={() => refetch()}
            emptyIcon={Users}
            emptyMessage={hasActiveFilters ? "Nenhum grupo com esses filtros." : "Ainda não há grupos cadastrados."}
          />
        </div>

        <AlertDialog open={!!removeGroup} onOpenChange={(open) => !open && setRemoveGroup(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Arquivar grupo</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                O grupo será arquivado e não aparecerá nas listas. Os dados históricos serão preservados.
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
                      .update({ is_archived: true })
                      .eq("id", removeGroup.id);
                    if (error) throw error;
                    notify.success("Grupo arquivado", "Tudo certo.");
                    setRemoveGroup(null);
                    refetch();
                  } catch (err: any) {
                    notify.error("Não foi possível arquivar", "Algo deu errado. Tente novamente.");
                  } finally {
                    setRemovingGroup(false);
                  }
                }}
                disabled={removingGroup}
              >
                Confirmar arquivamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!editInviteGroup} onOpenChange={(open) => !open && setEditInviteGroup(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Editar link de convite</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Informe o link de convite do WhatsApp para revalidar o grupo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <input
                type="text"
                value={inviteLinkInput}
                onChange={(e) => setInviteLinkInput(e.target.value)}
                placeholder="https://chat.whatsapp.com/…"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2" onClick={() => setEditInviteGroup(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!editInviteGroup) return;
                  const v = inviteLinkInput.trim();
                  const value = v.length ? v : null;
                  updateInviteMutation.mutate({ id: editInviteGroup.id, invite_link: value });
                }}
              >
                Salvar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!cascadeGroup} onOpenChange={(open) => !open && setCascadeGroup(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir grupo</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível e removerá o grupo e todos os dados associados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              {deletingCascade && (
                <div className="text-xs text-muted-foreground">Excluindo…</div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2" onClick={() => setCascadeGroup(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!cascadeGroup) return;
                  setDeletingCascade(true);
                  try {
                    const { error } = await supabase.functions.invoke("delete-resource-cascade", {
                      body: {
                        resourceType: "group",
                        resourceId: cascadeGroup.id,
                      },
                    });
                    if (error) throw error;
                    notify.success("Grupo excluído", "Tudo certo.");
                    setCascadeGroup(null);
                    refetch();
                  } catch (err: any) {
                    const parsed = await parseInvokeError(err);
                    if (parsed.code === "NETWORK_ERROR") {
                      notify.error("Falha de conexão", parsed.message);
                      return;
                    }
                    if (parsed.code === "DEPENDENCIES_EXIST") {
                      notify.warning("Dependências existentes", "Ainda há registros vinculados a este grupo.");
                      return;
                    }
                    if (parsed.code === "FORBIDDEN" || /forbidden/i.test(parsed.message)) {
                      notify.error("Acesso negado", "Apenas admins do sistema podem excluir grupos.");
                      return;
                    }
                    if (parsed.code === "UNAUTHORIZED" || /unauthorized/i.test(parsed.message)) {
                      notify.error("Sessão expirada", "Faça login novamente.");
                      return;
                    }
                    notify.error("Não foi possível excluir", parsed.message);
                  } finally {
                    setDeletingCascade(false);
                  }
                }}
                disabled={deletingCascade}
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
