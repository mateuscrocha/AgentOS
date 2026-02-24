import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, SlidersHorizontal, Users, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { Badge } from "@/components/ui/badge";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterBarRow } from "@/components/ui/filter-bar-row";
import { FilterTriggerButton } from "@/components/ui/filter-trigger-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusTag } from "@/components/ui/status-tag";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
const WHATSAPP_INVITE_HOST_RE = /(?:https?:\/\/)?chat\.whatsapp\.com\/[A-Za-z0-9]+/i;

function isValidWhatsAppInviteLink(value: string): boolean {
  return WHATSAPP_INVITE_HOST_RE.test((value ?? "").trim());
}

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
  const queryClient = useQueryClient();
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
  const [inviteLinkError, setInviteLinkError] = useState<string | null>(null);
  const [cascadeGroup, setCascadeGroup] = useState<GroupRow | null>(null);
  const [deletingCascade, setDeletingCascade] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [isSearchDebouncing, setIsSearchDebouncing] = useState(false);
  useEffect(() => {
    if (search === debouncedSearch) return;
    setIsSearchDebouncing(true);
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setIsSearchDebouncing(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, debouncedSearch]);

  const refreshGroupsList = async () => {
    await queryClient.invalidateQueries({ queryKey: ["system-groups"], exact: false });
  };

  const refreshGroupsOverview = async () => {
    await queryClient.invalidateQueries({ queryKey: ["system-groups-overview"] });
  };

  const refreshGroupsPageData = async ({ includeOverview = false }: { includeOverview?: boolean } = {}) => {
    await Promise.all([
      refreshGroupsList(),
      ...(includeOverview ? [refreshGroupsOverview()] : []),
    ]);
  };

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
    enabled: isAuthenticated && isSystemAdmin,
  });

  const { data: groupsData, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["system-groups", page, debouncedSearch, statusFilter, orgFilter, orderBy, orderDir],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("groups")
        .select("id, name, provider, status, organization_id, invite_link, created_at, organizations(name)", { count: "exact" })
        .eq("is_archived", false);

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
    enabled: isAuthenticated && isSystemAdmin,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["system-groups-overview"],
    queryFn: async () => {
      const isMissingGroupsOverviewRpcError = (rpcError: unknown) => {
        const code = String((rpcError as { code?: string } | null)?.code ?? "");
        const message = String((rpcError as { message?: string } | null)?.message ?? "");
        return code === "42883" || /function .*get_system_groups_overview/i.test(message);
      };

      const { data: rpcData, error: rpcError } = await (supabase as any).rpc("get_system_groups_overview");
      if (!rpcError) {
        const payload = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        return {
          total: Number(payload?.total ?? 0),
          active: Number(payload?.active ?? 0),
          inactive: Number(payload?.inactive ?? 0),
          avgMembers: Number(payload?.avg_members ?? payload?.avgMembers ?? 0),
        };
      }

      if (!isMissingGroupsOverviewRpcError(rpcError)) {
        throw rpcError;
      }

      const [total, active, inactive] = await Promise.all([
        supabase.from("groups").select("id", { count: "exact", head: true }).eq("is_archived", false),
        supabase
          .from("groups")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false)
          .eq("status", "active"),
        supabase
          .from("groups")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false)
          .eq("status", "inactive"),
      ]);

      const err = total.error || active.error || inactive.error;
      if (err) throw err;

      const { data: rows, error: membersErr } = await supabase
        .from("v_group_overview")
        .select("members_count")
        .eq("is_archived", false);
      if (membersErr) throw membersErr;

      const membersRows = (rows ?? []) as Array<{ members_count: number | null }>;
      const sumMembers = membersRows.reduce((sum, r) => sum + Number(r.members_count ?? 0), 0);
      const avgMembers = membersRows.length > 0 ? Math.round(sumMembers / membersRows.length) : 0;

      return {
        total: total.count ?? 0,
        active: active.count ?? 0,
        inactive: inactive.count ?? 0,
        avgMembers,
      };
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      const { error } = await supabase
        .from("groups")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      notify.success("Status atualizado", "Dados salvos com sucesso.");
      await refreshGroupsPageData({ includeOverview: true });
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
    onSuccess: async () => {
      notify.success("Convite atualizado", "Dados salvos com sucesso.");
      setEditInviteGroup(null);
      setInviteLinkInput("");
      await refreshGroupsPageData();
    },
    onError: (err: any) => {
      notify.error("Não foi possível atualizar convite", "Algo deu errado. Tente novamente.");
    },
  });

  useEffect(() => {
    const total = groupsData?.count;
    if (typeof total !== "number") return;
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [groupsData?.count, page]);

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
  const activeFiltersCount =
    Number(!!search.trim()) +
    Number(!!orgFilter) +
    Number(statusFilter !== "all") +
    Number(orderBy !== "created_at" || orderDir !== "desc");

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
        disabled={updateStatusMutation.isPending}
      >
        {updateStatusMutation.isPending && updateStatusMutation.variables?.id === g.id
          ? "Atualizando..."
          : g.status === "active" ? "Desativar" : "Reativar"}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditInviteGroup(g);
          setInviteLinkInput(g.invite_link || "");
          setInviteLinkError(null);
        }}
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
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
          onClick={(e) => {
            e.stopPropagation();
            if (g.organization_id) navigate(`/organization/${g.organization_id}/dashboard`);
          }}
          aria-label={g.organizations?.name ? `Abrir organização ${g.organizations.name}` : "Abrir organização"}
        >
          {g.organizations?.name || "—"}
        </button>
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

  const sortValue = `${orderBy}:${orderDir}`;
  const setSortValue = (value: string) => {
    const [by, dir] = value.split(":");
    if ((by === "created_at" || by === "name") && (dir === "asc" || dir === "desc")) {
      setOrderBy(by);
      setOrderDir(dir);
      setPage(1);
    }
  };

  const sortLabel = (() => {
    if (sortValue === "created_at:desc") return "";
    if (sortValue === "created_at:asc") return "Ordenação: mais antigas";
    if (sortValue === "name:asc") return "Ordenação: nome (A-Z)";
    if (sortValue === "name:desc") return "Ordenação: nome (Z-A)";
    return "Ordenação personalizada";
  })();

  const filtersForm = (
    <>
      <div className="relative w-full md:w-72">
        <Input
          type="text"
          placeholder="Buscar por nome"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 w-full pr-9 bg-background/60"
          aria-label="Buscar grupos por nome"
        />
        {isSearchDebouncing && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <Select
        value={orgFilter || "__all__"}
        onValueChange={(v) => {
          setOrgFilter(v === "__all__" ? "" : v);
          setPage(1);
        }}
      >
        <SelectTrigger className="h-9 w-full sm:w-auto min-w-[12rem] bg-background/60" aria-label="Filtrar por organização">
          <SelectValue placeholder="Organização" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Organização: todas</SelectItem>
          {(organizations ?? []).map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v as any);
          setPage(1);
        }}
      >
        <SelectTrigger className="h-9 w-full sm:w-auto min-w-[11rem] bg-background/60" aria-label="Filtrar por status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Status: todos</SelectItem>
          <SelectItem value="active">Status: ativos</SelectItem>
          <SelectItem value="inactive">Status: inativos</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortValue} onValueChange={setSortValue}>
        <SelectTrigger className="h-9 w-full sm:w-auto min-w-[14rem] bg-background/60" aria-label="Ordenação">
          <SelectValue placeholder="Ordenação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at:desc">Ordenar: mais recentes</SelectItem>
          <SelectItem value="created_at:asc">Ordenar: mais antigas</SelectItem>
          <SelectItem value="name:asc">Ordenar: nome (A-Z)</SelectItem>
          <SelectItem value="name:desc">Ordenar: nome (Z-A)</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  const activeFilterChips = (() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `Busca: ${search.trim()}`,
        onClear: () => {
          setSearch("");
          setPage(1);
        },
      });
    }
    if (orgFilter) {
      const name = (organizations ?? []).find((o) => o.id === orgFilter)?.name;
      chips.push({
        key: "org",
        label: `Organização: ${name || "Selecionada"}`,
        onClear: () => {
          setOrgFilter("");
          setPage(1);
        },
      });
    }
    if (statusFilter !== "all") {
      chips.push({
        key: "status",
        label: statusFilter === "active" ? "Status: ativos" : "Status: inativos",
        onClear: () => {
          setStatusFilter("all");
          setPage(1);
        },
      });
    }
    if (sortLabel) {
      chips.push({
        key: "sort",
        label: sortLabel,
        onClear: () => {
          setOrderBy("created_at");
          setOrderDir("desc");
          setPage(1);
        },
      });
    }
    return chips;
  })();

  return (
    <AdminLayout title="Grupos" subtitle="Central de Comando › Grupos">
      <div className="space-y-6 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Grupos" }]}
          title="Grupos"
          description="Todos os grupos conectados ao Bóris"
          generalKpis={(
            <>
              <StatsCard
                title="Total"
                value={overview?.total?.toLocaleString("pt-BR") ?? "—"}
                icon={Users}
                variant="kpi"
                isLoading={overviewLoading}
                numericValue
                help={{
                  whatIs: "Quantidade total de grupos cadastrados no sistema (considerando os filtros da tela, quando aplicável).",
                  howToInterpret: "Mostra o tamanho da base de grupos monitorados.",
                  whatToObserve: "Compare com ‘Ativos’ e ‘Inativos’ para entender a distribuição do status dos grupos.",
                }}
              />
              <StatsCard
                title="Ativos"
                value={overview?.active?.toLocaleString("pt-BR") ?? "—"}
                icon={CheckCircle}
                variant="kpi"
                isLoading={overviewLoading}
                numericValue
                help={{
                  whatIs: "Quantidade de grupos com status ativo.",
                  howToInterpret: "Representa grupos habilitados/operando normalmente na base.",
                  whatToObserve: "Acompanhe a proporção sobre o total e mudanças após ações operacionais.",
                }}
              />
              <StatsCard
                title="Inativos"
                value={overview?.inactive?.toLocaleString("pt-BR") ?? "—"}
                icon={XCircle}
                variant="kpi"
                isLoading={overviewLoading}
                numericValue
                help={{
                  whatIs: "Quantidade de grupos com status inativo.",
                  howToInterpret: "Mostra grupos desativados ou fora de operação no cadastro do sistema.",
                  whatToObserve: "Observe tendência de crescimento e se há concentração em alguma organização.",
                }}
              />
              <StatsCard
                title="Média de membros"
                value={overviewLoading ? "—" : (overview?.avgMembers ?? 0).toLocaleString("pt-BR")}
                icon={BarChart3}
                variant="kpi"
                isLoading={overviewLoading}
                numericValue
                help={{
                  whatIs: "Número médio de membros por grupo na base atual.",
                  howToInterpret: "Ajuda a entender o porte médio dos grupos, sem depender apenas de casos extremos.",
                  whatToObserve: "Compare com atividade para distinguir grupos grandes pouco ativos de grupos menores mais engajados.",
                }}
              />
            </>
          )}
        />

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
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Limpar filtros
                </Button>
              </>
            ) : null}
          />

          {activeFilterChips.length > 0 && (
            <FilterChips
              className="mt-3"
              items={activeFilterChips.map((chip) => ({
                key: chip.key,
                label: chip.label,
                onRemove: chip.onClear,
              }))}
            />
          )}
        </div>

        <ListSectionHeader
          title="Lista de grupos"
          count={typeof groupsData?.count === "number" ? groupsData.count.toLocaleString("pt-BR") : "—"}
          statusLabel={hasActiveFilters ? ADMIN_MICROCOPY.listStatus.filtered : ADMIN_MICROCOPY.listStatus.allRecords}
          isLoading={isFetching}
          loadingIndicator={<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
        />

        <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DrawerContent className="bg-card border-border">
            <DrawerHeader className="text-left">
              <DrawerTitle>Filtrar grupos</DrawerTitle>
              <DrawerDescription>Encontre mais rápido usando busca, organização, status e ordenação.</DrawerDescription>
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
                    handleClearFilters();
                    setFiltersOpen(false);
                  }}
                >
                  Limpar filtros
                </Button>
              )}
              <DrawerClose asChild>
                <Button type="button">
                  Ver resultados{typeof groupsData?.count === "number" ? ` (${groupsData.count.toLocaleString("pt-BR")})` : ""}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <div className="md:hidden">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="rounded-2xl bg-secondary/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
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
                        <button
                          type="button"
                          className="mt-0.5 truncate text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (g.organization_id) navigate(`/organization/${g.organization_id}/dashboard`);
                          }}
                          aria-label={g.organizations?.name ? `Abrir organização ${g.organizations.name}` : "Abrir organização"}
                        >
                          {g.organizations?.name || "—"}
                        </button>
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
                O grupo <span className="font-medium text-foreground">{removeGroup?.name || "selecionado"}</span> será arquivado e não aparecerá nas listas. Os dados históricos serão preservados.
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
                    await refreshGroupsPageData({ includeOverview: true });
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
                Informe o link de convite do WhatsApp para revalidar o grupo <span className="font-medium text-foreground">{editInviteGroup?.name || "selecionado"}</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <input
                type="text"
                value={inviteLinkInput}
                onChange={(e) => {
                  setInviteLinkInput(e.target.value);
                  if (inviteLinkError) setInviteLinkError(null);
                }}
                placeholder="https://chat.whatsapp.com/…"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
              {inviteLinkError && (
                <div className="text-xs text-destructive">{inviteLinkError}</div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2" onClick={() => setEditInviteGroup(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!editInviteGroup) return;
                  const v = inviteLinkInput.trim();
                  if (v.length > 0 && !isValidWhatsAppInviteLink(v)) {
                    setInviteLinkError("Cole um link de convite válido do WhatsApp.");
                    return;
                  }
                  const value = v.length ? v : null;
                  updateInviteMutation.mutate({ id: editInviteGroup.id, invite_link: value });
                }}
                disabled={updateInviteMutation.isPending}
              >
                {updateInviteMutation.isPending ? "Salvando..." : "Salvar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!cascadeGroup} onOpenChange={(open) => !open && setCascadeGroup(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir grupo</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível e removerá o grupo <span className="font-medium text-foreground">{cascadeGroup?.name || "selecionado"}</span> e todos os dados associados.
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
                    await refreshGroupsPageData({ includeOverview: true });
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
