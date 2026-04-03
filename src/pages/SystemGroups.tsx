import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Building2,
  CheckCircle,
  Loader2,
  SlidersHorizontal,
  Users,
  XCircle,
} from "lucide-react";
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
import { Link, useNavigate } from "react-router-dom";
import { formatDateSimpleBR, formatDateTickBR } from "@/lib/date";
import { notifyActionError } from "@/lib/notify-action-error";
import { SendGroupMessageDialog } from "@/components/modals/SendGroupMessageDialog";
import { sendGroupMessageWebhook } from "@/lib/group-message-webhook";

interface GroupRow {
  id: string;
  name: string;
  provider: string;
  status: string | null;
  organization_id: string;
  organizations?: { name: string } | null;
  invite_link?: string | null;
  created_at?: string;
  last_message_at?: string | null;
  members_count?: number;
  activity_24h?: number;
}

interface OrganizationOption { id: string; name: string; }

const PAGE_SIZE = 10;
const WHATSAPP_INVITE_HOST_RE = /^(?:https?:\/\/)?chat\.whatsapp\.com\/[A-Za-z0-9]+$/i;

function normalizeWhatsAppInviteLink(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return trimmed.split(/[?#]/, 1)[0]?.trim() ?? "";
  }
}

function isValidWhatsAppInviteLink(value: string): boolean {
  return WHATSAPP_INVITE_HOST_RE.test(normalizeWhatsAppInviteLink(value));
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
  const [orderBy, setOrderBy] = useState<"activity_24h" | "created_at" | "name">("activity_24h");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");
  const [removeGroup, setRemoveGroup] = useState<GroupRow | null>(null);
  const [removingGroup, setRemovingGroup] = useState(false);
  const [editInviteGroup, setEditInviteGroup] = useState<GroupRow | null>(null);
  const [inviteLinkInput, setInviteLinkInput] = useState("");
  const [inviteLinkError, setInviteLinkError] = useState<string | null>(null);
  const [cascadeGroup, setCascadeGroup] = useState<GroupRow | null>(null);
  const [deletingCascade, setDeletingCascade] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sendMessageGroup, setSendMessageGroup] = useState<GroupRow | null>(null);

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

      if (orderBy !== "activity_24h") {
        query = query.order(orderBy, { ascending: orderDir === "asc" });
      }

      const { data, error, count } = await (
        orderBy === "activity_24h"
          ? query
          : query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      );
      if (error) throw error;

      const items = (data ?? []) as GroupRow[];
      const groupIds = items.map((g) => g.id).filter(Boolean);
      if (groupIds.length) {
        const { data: overviewData, error: overviewErr } = await supabase
          .from("v_group_overview")
          .select("group_id, last_message_at, members_count")
          .in("group_id", groupIds);
        if (!overviewErr && Array.isArray(overviewData)) {
          const byId = new Map<string, any>();
          overviewData.forEach((row: any) => {
            if (row?.group_id) byId.set(row.group_id, row);
          });
          items.forEach((g) => {
            const o = byId.get(g.id);
            if (!o) return;
            g.last_message_at = o.last_message_at;
            g.members_count = typeof o.members_count === "number" ? o.members_count : Number(o.members_count ?? 0);
          });
        }

        const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentMessages, error: recentMessagesErr } = await supabase
          .from("messages")
          .select("group_id")
          .in("group_id", groupIds)
          .is("deleted_at", null)
          .gte("created_at", sinceIso);

        if (!recentMessagesErr && Array.isArray(recentMessages)) {
          const activityByGroupId = new Map<string, number>();
          recentMessages.forEach((row: any) => {
            const groupId = String(row?.group_id ?? "");
            if (!groupId) return;
            activityByGroupId.set(groupId, (activityByGroupId.get(groupId) ?? 0) + 1);
          });
          items.forEach((g) => {
            g.activity_24h = activityByGroupId.get(g.id) ?? 0;
          });
        } else {
          items.forEach((g) => {
            g.activity_24h = 0;
          });
        }
      }

      if (orderBy === "activity_24h") {
        const directionFactor = orderDir === "asc" ? 1 : -1;
        items.sort((a, b) => {
          const diff = (a.activity_24h ?? 0) - (b.activity_24h ?? 0);
          if (diff !== 0) return diff * directionFactor;
          return (a.name || "").localeCompare(b.name || "", "pt-BR") * directionFactor;
        });

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE;
        return { items: items.slice(from, to), count: items.length };
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
      notifyActionError("Não foi possível atualizar status", err, "Tente novamente.");
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
      notifyActionError("Não foi possível atualizar convite", err, "Tente novamente.");
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ group, message }: { group: GroupRow; message: string }) => {
      await sendGroupMessageWebhook({
        groupId: group.id,
        groupName: group.name || "Grupo",
        message,
      });
    },
    onSuccess: () => {
      notify.success("Mensagem enviada", "Tudo certo.");
      setSendMessageGroup(null);
    },
    onError: (err: any) => {
      notifyActionError("Não foi possível enviar mensagem", err, "Tente novamente.");
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

  const hasActiveFilters = !!search || !!orgFilter || statusFilter !== "all" || orderBy !== "activity_24h" || orderDir !== "desc";
  const activeFiltersCount =
    Number(!!search.trim()) +
    Number(!!orgFilter) +
    Number(statusFilter !== "all") +
    Number(orderBy !== "activity_24h" || orderDir !== "desc");

  const handleClearFilters = () => {
    setSearch("");
    setOrgFilter("");
    setStatusFilter("all");
    setOrderBy("activity_24h");
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
        onClick={(e) => {
          e.stopPropagation();
          setSendMessageGroup(g);
        }}
        className="w-full text-left px-2 py-1.5 text-sm"
      >
        Enviar mensagem
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
      className: "max-w-[18rem] lg:max-w-[22rem]",
      sortable: true,
      sortValue: (g: GroupRow) => g.name || "",
      render: (g: GroupRow) => (
        <div className="min-w-0 max-w-[18rem] lg:max-w-[22rem] space-y-2">
          <Link
            to={`/groups/${g.id}`}
            className="block truncate text-sm font-semibold text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {g.name || "—"}
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50/80 px-2 py-0.5 text-amber-800">
              <Building2 className="h-3 w-3" />
              {g.organizations?.name || "Sem organização"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
              {typeof g.members_count === "number" ? g.members_count.toLocaleString("pt-BR") : "—"} membros
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "organizations",
      header: "Organização",
      hideOn: "lg",
      className: "max-w-[14rem] lg:max-w-[18rem]",
      render: (g: GroupRow) => (
        <button
          type="button"
          className="block w-full truncate text-left text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
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
      hideOn: "lg",
      render: (g: GroupRow) => (
        <span className="tabular-nums text-sm font-semibold text-foreground">{typeof g.members_count === "number" ? g.members_count.toLocaleString("pt-BR") : "—"}</span>
      ),
    },
    {
      key: "created_at",
      header: "Criado",
      hideOn: "lg",
      sortable: true,
      render: (g: GroupRow) => (
        <span className="text-xs text-muted-foreground">{g.created_at ? formatDateSimpleBR(g.created_at) : "—"}</span>
      ),
    },
    {
      key: "activity_24h",
      header: "Atividade (24h)",
      hideOn: "lg",
      sortable: true,
      render: (g: GroupRow) => {
        const count = g.activity_24h ?? 0;
        const barWidth = Math.max(10, Math.min(100, count === 0 ? 10 : count));
        return (
          <div className="min-w-[10rem]">
            <div className="flex items-center justify-between gap-3">
              <span className={count > 0 ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground"}>
                {count.toLocaleString("pt-BR")} msg{count === 1 ? "" : "s"}
              </span>
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">24h</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-600"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
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
    if ((by === "activity_24h" || by === "created_at" || by === "name") && (dir === "asc" || dir === "desc")) {
      setOrderBy(by as "activity_24h" | "created_at" | "name");
      setOrderDir(dir);
      setPage(1);
    }
  };

  const sortLabel = (() => {
    if (sortValue === "activity_24h:desc") return "";
    if (sortValue === "activity_24h:asc") return "Ordenação: menos atividade nas últimas 24h";
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
          <SelectItem value="activity_24h:desc">Ordenar: mais ativos (24h)</SelectItem>
          <SelectItem value="activity_24h:asc">Ordenar: menos ativos (24h)</SelectItem>
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
          setOrderBy("activity_24h");
          setOrderDir("desc");
          setPage(1);
        },
      });
    }
    return chips;
  })();

  const visibleGroups = groupsData?.items ?? [];
  const totalGroups = overview?.total ?? 0;
  const activeGroups = overview?.active ?? 0;
  const inactiveGroups = overview?.inactive ?? 0;
  const averageMembers = overview?.avgMembers ?? 0;
  const visibleActivity24h = visibleGroups.reduce((sum, group) => sum + (group.activity_24h ?? 0), 0);

  return (
    <AdminLayout title="Grupos" subtitle="Central de Comando › Grupos">
      <div className="mx-auto max-w-[1480px] space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Grupos" }]}
          title="Grupos"
          description="Visão operacional da base de grupos conectados ao Bóris, com foco nos indicadores principais e na lista de gestão."
          actions={(
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button onClick={() => refetch()}>
                Atualizar dados
              </Button>
            </div>
          )}
          generalKpis={(
            <>
              <div className="rounded-[24px] border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,1))] p-4 shadow-[0_18px_40px_-30px_rgba(120,53,15,0.22)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">Total</div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{totalGroups.toLocaleString("pt-BR")}</div>
                <div className="mt-2 text-sm text-slate-600">grupos cadastrados na base</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.12)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Ativos
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{activeGroups.toLocaleString("pt-BR")}</div>
                <div className="mt-2 text-sm text-slate-600">operando normalmente</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.12)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <XCircle className="h-3.5 w-3.5 text-rose-500" />
                  Inativos
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{inactiveGroups.toLocaleString("pt-BR")}</div>
                <div className="mt-2 text-sm text-slate-600">fora de operação</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.12)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <BarChart3 className="h-3.5 w-3.5 text-amber-600" />
                  Atividade 24h
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{visibleActivity24h.toLocaleString("pt-BR")}</div>
                <div className="mt-2 text-sm text-slate-600">mensagens no recorte atual</div>
              </div>
            </>
          )}
        />

        <section className="rounded-[30px] border border-slate-200/80 bg-white/95 p-3 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.25)] sm:p-4">
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
        </section>

        <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DrawerContent className="border-border bg-card">
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

        <section className="rounded-[32px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.28)] sm:p-5">
          <ListSectionHeader
            title="Lista de grupos"
            count={typeof groupsData?.count === "number" ? groupsData.count.toLocaleString("pt-BR") : "—"}
            statusLabel={hasActiveFilters ? ADMIN_MICROCOPY.listStatus.filtered : ADMIN_MICROCOPY.listStatus.allRecords}
            isLoading={isFetching}
            loadingIndicator={<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
          />

        <div className="mt-4 md:hidden">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-4 shadow-subtle">
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
                const activity24h = g.activity_24h ?? 0;
                const activity24hLabel = `${activity24h.toLocaleString("pt-BR")} msg${activity24h === 1 ? "" : "s"} nas últimas 24h`;

                return (
                  <div
                    key={g.id}
                    className="cursor-pointer rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_24px_44px_-34px_rgba(120,53,15,0.35)]"
                    onClick={() => navigate(`/groups/${g.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold tracking-[-0.025em] text-slate-950">{g.name || "—"}</div>
                        <button
                          type="button"
                          className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm text-slate-500 hover:text-slate-950 hover:underline underline-offset-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (g.organization_id) navigate(`/organization/${g.organization_id}/dashboard`);
                          }}
                          aria-label={g.organizations?.name ? `Abrir organização ${g.organizations.name}` : "Abrir organização"}
                        >
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
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

                    <div className="mt-4 grid gap-3 rounded-[20px] border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Porte</div>
                          <div className="mt-1">
                            <span className="font-semibold tabular-nums text-slate-950">{membersLabel}</span>
                            <span> membros</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Atividade</div>
                          <div className={activity24h > 0 ? "mt-1 font-medium text-slate-950" : "mt-1"}>
                            {activity24hLabel}
                          </div>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500"
                          style={{ width: `${Math.max(10, Math.min(100, activity24h === 0 ? 10 : activity24h))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className={getLastActivityTone(g.last_message_at) === "attention" ? "text-amber-800" : "text-slate-500"}>
                          Última atividade: {g.last_message_at ? formatDateTickBR(g.last_message_at) : "sem registro recente"}
                        </span>
                        <span className="text-slate-400">
                          Criado em {g.created_at ? formatDateSimpleBR(g.created_at) : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end">
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

        <div className="mt-4 hidden md:block">
          <BorisTable
            columns={columns as any}
            data={groupsData?.items ?? []}
            keyExtractor={(g) => g.id}
            onRowClick={(g) => navigate(`/groups/${g.id}`)}
            rowHref={(g) => `/groups/${g.id}`}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={groupsData?.count}
            onPageChange={setPage}
            loading={isLoading}
            error={!!error}
            onRetry={() => refetch()}
            sortMode="manual"
            sortState={{ key: orderBy, direction: orderDir }}
            onSortChange={(sort) => {
              if (!sort || (sort.key !== "name" && sort.key !== "created_at" && sort.key !== "activity_24h")) return;
              setOrderBy(sort.key as "activity_24h" | "created_at" | "name");
              setOrderDir(sort.direction);
              setPage(1);
            }}
            emptyIcon={Users}
            emptyMessage={hasActiveFilters ? "Nenhum grupo com esses filtros." : "Ainda não há grupos cadastrados."}
          />
        </div>
        </section>

        <AlertDialog open={!!removeGroup} onOpenChange={(open) => !open && setRemoveGroup(null)}>
          <AlertDialogContent className="border-border bg-card">
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
                    notifyActionError("Não foi possível arquivar", err, "Tente novamente.");
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
          <AlertDialogContent className="border-border bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Editar link de convite</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Informe o link de convite do WhatsApp para revalidar o grupo <span className="font-medium text-foreground">{editInviteGroup?.name || "selecionado"}</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <Input
                type="text"
                value={inviteLinkInput}
                onChange={(e) => {
                  setInviteLinkInput(e.target.value);
                  if (inviteLinkError) setInviteLinkError(null);
                }}
                placeholder="https://chat.whatsapp.com/…"
                className="w-full"
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
                  const normalized = normalizeWhatsAppInviteLink(v);
                  if (v.length > 0 && !isValidWhatsAppInviteLink(normalized)) {
                    setInviteLinkError("Cole um link de convite válido do WhatsApp.");
                    return;
                  }
                  const value = normalized.length ? normalized : null;
                  if (value) setInviteLinkInput(value);
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
          <AlertDialogContent className="border-border bg-card">
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
                      notifyActionError("Falha de conexão", parsed, "Tente novamente.");
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
                    notifyActionError("Não foi possível excluir", parsed, "Tente novamente.");
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

        <SendGroupMessageDialog
          open={!!sendMessageGroup}
          onOpenChange={(open) => !open && setSendMessageGroup(null)}
          groupName={sendMessageGroup?.name || "Grupo"}
          isSubmitting={sendMessageMutation.isPending}
          onSubmit={async (message) => {
            if (!sendMessageGroup) return;
            await sendMessageMutation.mutateAsync({ group: sendMessageGroup, message });
          }}
        />

      </div>
    </AdminLayout>
  );
}
