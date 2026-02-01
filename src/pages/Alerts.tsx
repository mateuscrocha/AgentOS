import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { BorisTable, RowActions, type BorisColumn } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, type DateRange, type PeriodType } from "@/components/group-dashboard/period-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { notify } from "@/components/ui/sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle, Bell, Filter, Plus, Search, Settings } from "lucide-react";
import { formatDateTimeBR, formatDateSimpleBR } from "@/lib/date";

type GroupOption = {
  id: string;
  name: string;
  organization_id: string;
};

type OrgOption = {
  id: string;
  name: string;
};

type AlertEvent = {
  id: string;
  status: "unread" | "read" | "archived";
  occurrences: number;
  snippet: string | null;
  last_triggered_at: string;
  group_id: string;
  last_message_id: string | null;
  alert_definition_id: string;
  alert_term_id: string;
  groups?: { name: string } | null;
  alert_definitions?: { name: string } | null;
  alert_terms?: { term_raw: string } | null;
};

type AlertDefinition = {
  id: string;
  name: string;
  status: "active" | "inactive";
  organization_id: string | null;
  group_id: string | null;
  scope_all_groups: boolean;
  match_mode: "WINDOW" | "PER_MESSAGE";
  dedupe_window_sec: number;
  notify_in_app: boolean;
  updated_at: string;
  created_at: string;
};

type AlertTerm = {
  id: string;
  alert_definition_id: string;
  term_raw: string;
  term_norm: string;
  term_kind: "word" | "phrase";
};

type DefinitionScopeType = "system" | "org" | "group";

const EVENTS_PAGE_SIZE = 50;
const DEFINITIONS_PAGE_SIZE = 25;

function deriveScopeType(d: AlertDefinition): DefinitionScopeType {
  if (d.scope_all_groups) {
    if (d.organization_id) return "org";
    return "system";
  }
  return "group";
}

export default function Alerts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { loading: authLoading, user, isAuthenticated } = useAuth();
  const {
    isLoading: rolesLoading,
    isSystemAdmin,
    isOrgAdmin,
    isGroupManager,
    getAccessibleOrgIds,
    getAccessibleGroupIds,
  } = useUserRoles();

  const canUseAlerts = isSystemAdmin || isOrgAdmin || isGroupManager;

  const [tab, setTab] = useState("events");

  const [eventsPage, setEventsPage] = useState(1);
  const [definitionsPage, setDefinitionsPage] = useState(1);

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("7d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const currentRange = getDateRange(selectedPeriod, customRange);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();

  const [statusFilter, setStatusFilter] = useState<"all" | AlertEvent["status"]>("unread");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [termFilter, setTermFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AlertDefinition | null>(null);
  const [removeDefinition, setRemoveDefinition] = useState<AlertDefinition | null>(null);
  const [removeTerm, setRemoveTerm] = useState<AlertTerm | null>(null);

  const [formName, setFormName] = useState("");
  const [formScopeType, setFormScopeType] = useState<DefinitionScopeType>("group");
  const [formOrgId, setFormOrgId] = useState<string>("");
  const [formGroupId, setFormGroupId] = useState<string>("");
  const [formStatus, setFormStatus] = useState<AlertDefinition["status"]>("active");
  const [formMatchMode, setFormMatchMode] = useState<AlertDefinition["match_mode"]>("WINDOW");
  const [formDedupeWindowSec, setFormDedupeWindowSec] = useState<number>(300);
  const [formNotifyInApp, setFormNotifyInApp] = useState(true);
  const [termInput, setTermInput] = useState("");
  const [termDrafts, setTermDrafts] = useState<string[]>([]);

  const periodLabel = `${formatDateSimpleBR(currentRange.from)} — ${formatDateSimpleBR(currentRange.to)}`;

  const orgIds = useMemo(() => getAccessibleOrgIds(), [getAccessibleOrgIds]);
  const groupIds = useMemo(() => getAccessibleGroupIds(), [getAccessibleGroupIds]);

  const orgsQuery = useQuery<OrgOption[]>({
    queryKey: ["alerts", "orgs", isSystemAdmin, orgIds],
    queryFn: async () => {
      let q = supabase.from("organizations").select("id,name").order("name", { ascending: true });
      if (!isSystemAdmin) {
        if (!orgIds.length) return [];
        q = q.in("id", orgIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OrgOption[];
    },
    enabled: isAuthenticated && canUseAlerts,
  });

  const groupsQuery = useQuery<GroupOption[]>({
    queryKey: ["alerts", "groups", isSystemAdmin, orgIds, groupIds],
    queryFn: async () => {
      let q = supabase.from("groups").select("id,name,organization_id").order("name", { ascending: true });
      if (!isSystemAdmin) {
        if (groupIds.length) {
          q = q.in("id", groupIds);
        } else if (orgIds.length) {
          q = q.in("organization_id", orgIds);
        } else {
          return [];
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GroupOption[];
    },
    enabled: isAuthenticated && canUseAlerts,
  });

  const definitionsQuery = useQuery<{ items: AlertDefinition[]; total: number }>({
    queryKey: ["alerts", "definitions", definitionsPage],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("alert_definitions")
        .select(
          "id,name,status,organization_id,group_id,scope_all_groups,match_mode,dedupe_window_sec,notify_in_app,updated_at,created_at",
          { count: "exact" },
        )
        .order("updated_at", { ascending: false })
        .range((definitionsPage - 1) * DEFINITIONS_PAGE_SIZE, definitionsPage * DEFINITIONS_PAGE_SIZE - 1);

      if (error) throw error;
      return { items: (data ?? []) as AlertDefinition[], total: count ?? 0 };
    },
    enabled: isAuthenticated && canUseAlerts,
  });

  const termsQuery = useQuery<AlertTerm[]>({
    queryKey: ["alerts", "terms", definitionsQuery.data?.items.map((d) => d.id).join(",")],
    queryFn: async () => {
      const ids = definitionsQuery.data?.items.map((d) => d.id) ?? [];
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("alert_terms")
        .select("id,alert_definition_id,term_raw,term_norm,term_kind")
        .in("alert_definition_id", ids)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AlertTerm[];
    },
    enabled: isAuthenticated && canUseAlerts && !!definitionsQuery.data?.items.length,
  });

  const termsByDefinition = useMemo(() => {
    const map = new Map<string, AlertTerm[]>();
    for (const t of termsQuery.data ?? []) {
      const cur = map.get(t.alert_definition_id) ?? [];
      cur.push(t);
      map.set(t.alert_definition_id, cur);
    }
    return map;
  }, [termsQuery.data]);

  const availableTerms = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    for (const t of termsQuery.data ?? []) {
      items.push({ id: t.id, label: t.term_raw });
    }
    items.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return items;
  }, [termsQuery.data]);

  const eventsQuery = useQuery<{ items: AlertEvent[]; total: number }>({
    queryKey: [
      "alerts",
      "events",
      eventsPage,
      selectedPeriod,
      customRange?.from?.toISOString(),
      customRange?.to?.toISOString(),
      statusFilter,
      groupFilter,
      termFilter,
      search,
    ],
    queryFn: async () => {
      let q = supabase
        .from("alert_events")
        .select(
          "id,status,occurrences,snippet,last_triggered_at,group_id,last_message_id,alert_definition_id,alert_term_id,groups(name),alert_definitions(name),alert_terms(term_raw)",
          { count: "exact" },
        )
        .gte("last_triggered_at", currentStartISO)
        .lte("last_triggered_at", currentEndISO)
        .order("last_triggered_at", { ascending: false })
        .range((eventsPage - 1) * EVENTS_PAGE_SIZE, eventsPage * EVENTS_PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      if (groupFilter !== "all") {
        q = q.eq("group_id", groupFilter);
      }
      if (termFilter !== "all") {
        q = q.eq("alert_term_id", termFilter);
      }
      const s = search.trim();
      if (s) {
        q = q.ilike("snippet", `%${s}%`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { items: (data ?? []) as AlertEvent[], total: count ?? 0 };
    },
    enabled: isAuthenticated && canUseAlerts,
  });

  const unreadCountQuery = useQuery<number>({
    queryKey: ["alerts", "unread-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("alert_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "unread");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: isAuthenticated && canUseAlerts,
    refetchInterval: 20_000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.from("alert_events").update({ status: "read" }).eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "unread-count"] }),
      ]);
    },
    onError: (e: any) => notify.error(e?.message ?? "Não foi possível atualizar o alerta."),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("alert_events").update({ status: "read" }).eq("status", "unread");
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "unread-count"] }),
      ]);
      notify.success("Alertas marcados como lidos.");
    },
    onError: (e: any) => notify.error(e?.message ?? "Não foi possível marcar como lidos."),
  });

  const upsertDefinitionMutation = useMutation({
    mutationFn: async (payload: Omit<AlertDefinition, "created_at" | "updated_at"> & { id?: string }) => {
      const { data, error } = await supabase
        .from("alert_definitions")
        .upsert(payload)
        .select(
          "id,name,status,organization_id,group_id,scope_all_groups,match_mode,dedupe_window_sec,notify_in_app,updated_at,created_at",
        )
        .single();
      if (error) throw error;
      return data as AlertDefinition;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts", "definitions"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms"] }),
      ]);
      notify.success("Definição salva.");
    },
    onError: (e: any) => notify.error(e?.message ?? "Não foi possível salvar."),
  });

  const addTermMutation = useMutation({
    mutationFn: async ({ definitionId, raw }: { definitionId: string; raw: string }) => {
      const { data, error } = await supabase
        .from("alert_terms")
        .insert({ alert_definition_id: definitionId, term_raw: raw })
        .select("id,alert_definition_id,term_raw,term_norm,term_kind")
        .single();
      if (error) throw error;
      return data as AlertTerm;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
      ]);
      setTermInput("");
      notify.success("Termo adicionado.");
    },
    onError: (e: any) => notify.error(e?.message ?? "Não foi possível adicionar o termo."),
  });

  const removeTermMutation = useMutation({
    mutationFn: async (termId: string) => {
      const { error } = await supabase.from("alert_terms").delete().eq("id", termId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
      ]);
      notify.success("Termo removido.");
    },
    onError: (e: any) => notify.error(e?.message ?? "Não foi possível remover o termo."),
  });

  const removeDefinitionMutation = useMutation({
    mutationFn: async (definitionId: string) => {
      const { error } = await supabase.from("alert_definitions").delete().eq("id", definitionId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts", "definitions"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "unread-count"] }),
      ]);
      notify.success("Definição removida.");
    },
    onError: (e: any) => notify.error(e?.message ?? "Não foi possível remover."),
  });

  const resetForm = () => {
    setFormName("");
    setFormScopeType(isSystemAdmin ? "system" : isOrgAdmin ? "org" : "group");
    setFormOrgId(orgsQuery.data?.[0]?.id ?? orgIds[0] ?? "");
    setFormGroupId(groupsQuery.data?.[0]?.id ?? groupIds[0] ?? "");
    setFormStatus("active");
    setFormMatchMode("WINDOW");
    setFormDedupeWindowSec(300);
    setFormNotifyInApp(true);
    setTermDrafts([]);
    setTermInput("");
  };

  useEffect(() => {
    if (!createOpen) {
      setEditing(null);
      resetForm();
    }
  }, [createOpen]);

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (d: AlertDefinition) => {
    setEditing(d);
    setFormName(d.name);
    setFormScopeType(deriveScopeType(d));
    setFormOrgId(d.organization_id ?? "");
    setFormGroupId(d.group_id ?? "");
    setFormStatus(d.status);
    setFormMatchMode(d.match_mode);
    setFormDedupeWindowSec(d.dedupe_window_sec);
    setFormNotifyInApp(d.notify_in_app);
    setTermDrafts([]);
    setTermInput("");
    setCreateOpen(true);
  };

  const addDraftTermsFromInput = () => {
    const raw = termInput
      .split(/\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!raw.length) return;
    setTermDrafts((prev) => {
      const set = new Set(prev.map((x) => x.toLocaleLowerCase("pt-BR")));
      const next = [...prev];
      for (const t of raw) {
        const key = t.toLocaleLowerCase("pt-BR");
        if (!set.has(key)) {
          set.add(key);
          next.push(t);
        }
      }
      return next;
    });
    setTermInput("");
  };

  const saveDefinition = async () => {
    const name = formName.trim();
    if (!name) {
      notify.error("Informe um nome.");
      return;
    }

    let organization_id: string | null = null;
    let group_id: string | null = null;
    let scope_all_groups = false;

    if (formScopeType === "system") {
      scope_all_groups = true;
      organization_id = null;
      group_id = null;
    }
    if (formScopeType === "org") {
      scope_all_groups = true;
      organization_id = formOrgId || null;
      group_id = null;
    }
    if (formScopeType === "group") {
      scope_all_groups = false;
      organization_id = null;
      group_id = formGroupId || null;
    }

    if (formScopeType === "org" && !organization_id) {
      notify.error("Selecione uma organização.");
      return;
    }
    if (formScopeType === "group" && !group_id) {
      notify.error("Selecione um grupo.");
      return;
    }

    const payload = {
      id: editing?.id,
      user_id: user!.id,
      name,
      organization_id,
      group_id,
      scope_all_groups,
      status: formStatus,
      match_mode: formMatchMode,
      dedupe_window_sec: Math.max(0, Math.floor(Number(formDedupeWindowSec) || 0)),
      notify_in_app: formNotifyInApp,
    };

    const saved = await upsertDefinitionMutation.mutateAsync(payload as any);

    if (termDrafts.length) {
      for (const rawTerm of termDrafts) {
        try {
          await addTermMutation.mutateAsync({ definitionId: saved.id, raw: rawTerm });
        } catch {
          void 0;
        }
      }
    }

    setCreateOpen(false);
  };

  const isFormScopeLocked = useMemo(() => {
    if (isSystemAdmin) return false;
    if (isOrgAdmin) return false;
    return true;
  }, [isOrgAdmin, isSystemAdmin]);

  const scopeOptions = useMemo(() => {
    const options: Array<{ value: DefinitionScopeType; label: string }> = [];
    if (isSystemAdmin) {
      options.push({ value: "system", label: "Sistema" });
      options.push({ value: "org", label: "Organização" });
      options.push({ value: "group", label: "Grupo" });
      return options;
    }
    if (isOrgAdmin) {
      options.push({ value: "org", label: "Organização" });
      options.push({ value: "group", label: "Grupo" });
      return options;
    }
    options.push({ value: "group", label: "Grupo" });
    return options;
  }, [isOrgAdmin, isSystemAdmin]);

  const filteredGroupsForForm = useMemo(() => {
    const groups = groupsQuery.data ?? [];
    if (formScopeType === "org" && formOrgId) {
      return groups.filter((g) => g.organization_id === formOrgId);
    }
    return groups;
  }, [formOrgId, formScopeType, groupsQuery.data]);

  const showClearFilters =
    selectedPeriod !== "7d" ||
    !!customRange ||
    statusFilter !== "unread" ||
    groupFilter !== "all" ||
    termFilter !== "all" ||
    !!search.trim();

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Alertas" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!canUseAlerts) {
    return <AccessDenied />;
  }

  const eventColumns: BorisColumn<AlertEvent>[] = [
    {
      key: "status",
      header: "Status",
      className: "w-[90px]",
      render: (ev) => (
        <span
          className={
            ev.status === "unread"
              ? "inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
              : ev.status === "archived"
                ? "inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                : "inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
          }
        >
          {ev.status === "unread" ? "Novo" : ev.status === "read" ? "Lido" : "Arquivado"}
        </span>
      ),
    },
    {
      key: "last_triggered_at",
      header: "Último disparo",
      render: (ev) => <span className="tabular-nums">{formatDateTimeBR(ev.last_triggered_at)}</span>,
    },
    {
      key: "groups",
      header: "Grupo",
      hideOn: "md" as any,
      render: (ev) => <span className="text-muted-foreground">{ev.groups?.name ?? "—"}</span>,
    },
    {
      key: "alert_terms",
      header: "Termo",
      render: (ev) => <span className="font-medium">{ev.alert_terms?.term_raw ?? "—"}</span>,
    },
    {
      key: "occurrences",
      header: "Ocorrências",
      className: "text-right",
      align: "right",
      hideOn: "md" as any,
      render: (ev) => <span className="tabular-nums text-muted-foreground">{ev.occurrences}</span>,
    },
    {
      key: "snippet",
      header: "Trecho",
      hideOn: "sm" as any,
      render: (ev) => <span className="text-muted-foreground">{ev.snippet ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right w-0",
      render: (ev) => (
        <RowActions>
          <DropdownMenuItem
            disabled={ev.status === "read"}
            onSelect={() => {
              if (ev.status !== "read") markReadMutation.mutate(ev.id);
            }}
          >
            Marcar como lido
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              navigate(`/groups/${ev.group_id}/messages`);
            }}
          >
            Abrir mensagens
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              void supabase
                .from("alert_events")
                .update({ status: "archived" })
                .eq("id", ev.id)
                .then(({ error }) => {
                  if (error) throw error;
                  return Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
                    queryClient.invalidateQueries({ queryKey: ["alerts", "unread-count"] }),
                  ]);
                })
                .then(() => notify.success("Alerta arquivado."))
                .catch((e: any) => notify.error(e?.message ?? "Não foi possível arquivar."));
            }}
            className="text-destructive focus:text-destructive"
          >
            Arquivar
          </DropdownMenuItem>
        </RowActions>
      ),
    },
  ];

  const definitionColumns: BorisColumn<AlertDefinition>[] = [
    {
      key: "name",
      header: "Nome",
      render: (d) => <span className="font-medium">{d.name}</span>,
    },
    {
      key: "scope",
      header: "Escopo",
      hideOn: "sm" as any,
      render: (d) => {
        const scope = deriveScopeType(d);
        if (scope === "system") return <span className="text-muted-foreground">Sistema</span>;
        if (scope === "org") {
          const orgName = orgsQuery.data?.find((o) => o.id === d.organization_id)?.name;
          return <span className="text-muted-foreground">Organização{orgName ? `: ${orgName}` : ""}</span>;
        }
        const g = groupsQuery.data?.find((g) => g.id === d.group_id);
        return <span className="text-muted-foreground">Grupo{g?.name ? `: ${g.name}` : ""}</span>;
      },
    },
    {
      key: "terms",
      header: "Termos",
      className: "text-right",
      align: "right",
      render: (d) => {
        const count = termsByDefinition.get(d.id)?.length ?? 0;
        return <span className="tabular-nums text-muted-foreground">{count}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      className: "w-[110px]",
      render: (d) => (
        <span
          className={
            d.status === "active"
              ? "inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
              : "inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
          }
        >
          {d.status === "active" ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "updated_at",
      header: "Atualizado",
      hideOn: "md" as any,
      render: (d) => <span className="tabular-nums text-muted-foreground">{formatDateTimeBR(d.updated_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right w-0",
      render: (d) => (
        <RowActions>
          <DropdownMenuItem onSelect={() => openEdit(d)}>Editar</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setTab("events");
              setStatusFilter("unread");
              setEventsPage(1);
              notify.success("Mostrando alertas não lidos.");
            }}
          >
            Ver alertas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setRemoveDefinition(d)}
          >
            Excluir
          </DropdownMenuItem>
        </RowActions>
      ),
    },
  ];

  const currentUnread = unreadCountQuery.data ?? 0;

  return (
    <AdminLayout title="Alertas" subtitle="Centro de alertas por termos monitorados">
      <div className="space-y-6">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Alertas" }]}
          title="Alertas"
          description="Termos monitorados e alertas por mensagens"
          actions={(
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => markAllReadMutation.mutate()} disabled={currentUnread === 0}>
                <Bell className="h-4 w-4 mr-1" />
                Marcar tudo como lido
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Nova definição
              </Button>
            </div>
          )}
          filters={(
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <PeriodFilter
                  value={selectedPeriod}
                  customRange={customRange}
                  onChange={(p, r) => {
                    setSelectedPeriod(p);
                    setCustomRange(p === "custom" ? r : undefined);
                    setEventsPage(1);
                  }}
                />
                <span className="text-xs text-muted-foreground">Período: {periodLabel}</span>
              </div>

              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as any);
                  setEventsPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unread">Não lidos</SelectItem>
                  <SelectItem value="read">Lidos</SelectItem>
                  <SelectItem value="archived">Arquivados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={groupFilter}
                onValueChange={(v) => {
                  setGroupFilter(v);
                  setEventsPage(1);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {(groupsQuery.data ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={termFilter}
                onValueChange={(v) => {
                  setTermFilter(v);
                  setEventsPage(1);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Termo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os termos</SelectItem>
                  {availableTerms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setEventsPage(1);
                  }}
                  placeholder="Buscar por trecho"
                  className="pl-9 w-[260px]"
                />
              </div>
            </div>
          )}
          showClearFilters={showClearFilters}
          onClearFilters={() => {
            setSelectedPeriod("7d");
            setCustomRange(undefined);
            setStatusFilter("unread");
            setGroupFilter("all");
            setTermFilter("all");
            setSearch("");
            setEventsPage(1);
          }}
          generalKpis={(
            <>
              <StatsCard title="Não lidos" value={currentUnread} icon={Bell} variant="kpi" />
              <StatsCard title="Definições" value={definitionsQuery.data?.total ?? "—"} icon={Settings} variant="kpi" />
            </>
          )}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="events">Centro de alertas</TabsTrigger>
            <TabsTrigger value="definitions">Definições</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="mt-4">
            <BorisTable
              columns={eventColumns as any}
              data={eventsQuery.data?.items ?? []}
              keyExtractor={(e) => e.id}
              page={eventsPage}
              pageSize={EVENTS_PAGE_SIZE}
              totalCount={eventsQuery.data?.total}
              onPageChange={setEventsPage}
              loading={eventsQuery.isLoading}
              error={!!eventsQuery.error}
              emptyIcon={AlertTriangle}
              emptyMessage="Nenhum alerta neste período."
              onRowClick={(e) => {
                if (e.status === "unread") markReadMutation.mutate(e.id);
                navigate(`/groups/${e.group_id}/messages`);
              }}
            />
          </TabsContent>

          <TabsContent value="definitions" className="mt-4">
            <BorisTable
              columns={definitionColumns as any}
              data={definitionsQuery.data?.items ?? []}
              keyExtractor={(d) => d.id}
              page={definitionsPage}
              pageSize={DEFINITIONS_PAGE_SIZE}
              totalCount={definitionsQuery.data?.total}
              onPageChange={setDefinitionsPage}
              loading={definitionsQuery.isLoading}
              error={!!definitionsQuery.error}
              emptyIcon={Settings}
              emptyMessage="Você ainda não tem definições de alerta."
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar definição" : "Nova definição"}</DialogTitle>
            <DialogDescription>Configure escopo, modo e termos monitorados.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Nome</div>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Atenção: termos sensíveis" />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Status</div>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Escopo</div>
                <Select
                  value={formScopeType}
                  onValueChange={(v) => {
                    setFormScopeType(v as any);
                    if (v === "org") {
                      setFormOrgId((prev) => prev || orgsQuery.data?.[0]?.id || orgIds[0] || "");
                      setFormGroupId("");
                    }
                    if (v === "group") {
                      setFormGroupId((prev) => prev || groupsQuery.data?.[0]?.id || groupIds[0] || "");
                      setFormOrgId("");
                    }
                    if (v === "system") {
                      setFormOrgId("");
                      setFormGroupId("");
                    }
                  }}
                  disabled={isFormScopeLocked}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formScopeType === "org" ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Organização</div>
                  <Select value={formOrgId} onValueChange={(v) => setFormOrgId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(orgsQuery.data ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {formScopeType === "group" ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Grupo</div>
                  <Select value={formGroupId} onValueChange={(v) => setFormGroupId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredGroupsForForm.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Modo</div>
                <Select value={formMatchMode} onValueChange={(v) => setFormMatchMode(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WINDOW">Janela</SelectItem>
                    <SelectItem value="PER_MESSAGE">Por mensagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Janela (seg)</div>
                <Input
                  type="number"
                  value={String(formDedupeWindowSec)}
                  onChange={(e) => setFormDedupeWindowSec(Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Notificar no Admin</div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                  <Switch checked={formNotifyInApp} onCheckedChange={setFormNotifyInApp} />
                  <span className="text-sm text-muted-foreground">Habilitado</span>
                </div>
              </div>
            </div>

            {editing ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Termos</div>
                <div className="rounded-xl border border-border bg-card">
                  <div className="p-3 border-b border-border flex items-center gap-2">
                    <Input
                      value={termInput}
                      onChange={(e) => setTermInput(e.target.value)}
                      placeholder="Digite um termo (vírgula ou enter para múltiplos)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addDraftTermsFromInput();
                          if (termDrafts.length === 0) return;
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        addDraftTermsFromInput();
                        const drafts = termDrafts;
                        if (!drafts.length) {
                          const raw = termInput.trim();
                          if (raw) addTermMutation.mutate({ definitionId: editing.id, raw });
                          return;
                        }
                        for (const raw of drafts) {
                          addTermMutation.mutate({ definitionId: editing.id, raw });
                        }
                        setTermDrafts([]);
                      }}
                      disabled={addTermMutation.isPending}
                    >
                      Adicionar
                    </Button>
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {(termsByDefinition.get(editing.id) ?? []).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-3 py-1 text-sm"
                          onClick={() => setRemoveTerm(t)}
                        >
                          <span>{t.term_raw}</span>
                          <span className="text-xs text-muted-foreground">remover</span>
                        </button>
                      ))}
                      {!(termsByDefinition.get(editing.id) ?? []).length ? (
                        <span className="text-sm text-muted-foreground">Nenhum termo ainda.</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-medium">Termos (criar)</div>
                <div className="flex items-center gap-2">
                  <Input
                    value={termInput}
                    onChange={(e) => setTermInput(e.target.value)}
                    placeholder="Digite termos separados por vírgula ou enter"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDraftTermsFromInput();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addDraftTermsFromInput}>
                    Incluir
                  </Button>
                </div>
                {termDrafts.length ? (
                  <div className="flex flex-wrap gap-2">
                    {termDrafts.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-secondary/30 px-3 py-1 text-sm">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Inclua pelo menos um termo para começar.</span>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void saveDefinition()}
              disabled={upsertDefinitionMutation.isPending || addTermMutation.isPending || (!editing && termDrafts.length === 0)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeDefinition} onOpenChange={(open) => !open && setRemoveDefinition(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definição?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove a definição, os termos e os alertas associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveDefinition(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const d = removeDefinition;
                setRemoveDefinition(null);
                if (d) removeDefinitionMutation.mutate(d.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTerm} onOpenChange={(open) => !open && setRemoveTerm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover termo?</AlertDialogTitle>
            <AlertDialogDescription>
              Remover o termo apaga alertas vinculados a ele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveTerm(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = removeTerm;
                setRemoveTerm(null);
                if (t) removeTermMutation.mutate(t.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
