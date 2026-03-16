import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { BorisTable, RowActions, type BorisColumn } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { notify } from "@/components/ui/sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle, Bell, Filter, Plus, Search, Settings } from "lucide-react";
import { formatDateTimeBR, formatDateSimpleBR } from "@/lib/date";
import {
  getCanonicalAlertDefinitionsPath,
  getCanonicalAlertsPath,
  isAlertDefinitionsPathname,
  shouldRedirectAlertDefinitionsPath,
  shouldRedirectAlertsPath,
} from "@/lib/alerts-routing";
import { notifyActionError } from "@/lib/notify-action-error";
import { notifyValidation } from "@/lib/notify-validation";

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
  const location = useLocation();
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
  const isDefinitionsPage = isAlertDefinitionsPathname(location.pathname);
  const canonicalAlertsPath = getCanonicalAlertsPath(isSystemAdmin);
  const canonicalAlertDefinitionsPath = getCanonicalAlertDefinitionsPath(isSystemAdmin);

  const [eventsPage, setEventsPage] = useState(1);
  const [definitionsPage, setDefinitionsPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState<"all" | AlertEvent["status"]>("unread");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [definitionFilter, setDefinitionFilter] = useState<string>("all");
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
  const realtimeInvalidateTimerRef = useRef<number | null>(null);

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

  const definitionsOptionsQuery = useQuery<Array<Pick<AlertDefinition, "id" | "name">>>({
    queryKey: ["alerts", "definitions-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_definitions")
        .select("id,name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<Pick<AlertDefinition, "id" | "name">>;
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

  const allTermsQuery = useQuery<AlertTerm[]>({
    queryKey: ["alerts", "terms-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_terms")
        .select("id,alert_definition_id,term_raw,term_norm,term_kind")
        .order("term_raw", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AlertTerm[];
    },
    enabled: isAuthenticated && canUseAlerts,
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
    for (const t of allTermsQuery.data ?? []) {
      items.push({ id: t.id, label: t.term_raw });
    }
    items.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return items;
  }, [allTermsQuery.data]);

  const eventsQuery = useQuery<{ items: AlertEvent[]; total: number }>({
    queryKey: [
      "alerts",
      "events",
      eventsPage,
      statusFilter,
      groupFilter,
      definitionFilter,
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
        .order("last_triggered_at", { ascending: false })
        .range((eventsPage - 1) * EVENTS_PAGE_SIZE, eventsPage * EVENTS_PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      if (groupFilter !== "all") {
        q = q.eq("group_id", groupFilter);
      }
      if (definitionFilter !== "all") {
        q = q.eq("alert_definition_id", definitionFilter);
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

  useEffect(() => {
    if (!isAuthenticated || !canUseAlerts) return;
    if (typeof (supabase as any).channel !== "function") return;

    const scheduleAlertsRefresh = () => {
      if (realtimeInvalidateTimerRef.current !== null) return;

      realtimeInvalidateTimerRef.current = globalThis.setTimeout(() => {
        realtimeInvalidateTimerRef.current = null;

        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
          queryClient.invalidateQueries({ queryKey: ["alerts", "unread-count"] }),
          queryClient.invalidateQueries({ queryKey: ["alerts", "definitions"] }),
          queryClient.invalidateQueries({ queryKey: ["alerts", "definitions-options"] }),
          queryClient.invalidateQueries({ queryKey: ["alerts", "terms"] }),
          queryClient.invalidateQueries({ queryKey: ["alerts", "terms-all"] }),
        ]);
      }, 300);
    };

    const channel = supabase
      .channel(`realtime:alerts:${user?.id ?? "anonymous"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alert_events" }, scheduleAlertsRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "alert_definitions" }, scheduleAlertsRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "alert_terms" }, scheduleAlertsRefresh)
      .subscribe();

    return () => {
      if (realtimeInvalidateTimerRef.current !== null) {
        globalThis.clearTimeout(realtimeInvalidateTimerRef.current);
        realtimeInvalidateTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [canUseAlerts, isAuthenticated, queryClient, user?.id]);

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
    onError: (e: any) => notifyActionError("Não foi possível marcar como lido", e, "Tente novamente."),
  });

  const markUnreadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.from("alert_events").update({ status: "unread" }).eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "unread-count"] }),
      ]);
    },
    onError: (e: any) => notifyActionError("Não foi possível reabrir alerta", e, "Tente novamente."),
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
      notify.success("Alertas marcados como lidos", "A lista foi atualizada.");
    },
    onError: (e: any) => notifyActionError("Não foi possível marcar alertas como lidos", e, "Tente novamente."),
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
        queryClient.invalidateQueries({ queryKey: ["alerts", "definitions-options"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms"] }),
      ]);
      notify.success("Definição salva", "Configuração atualizada com sucesso.");
    },
    onError: (e: any) => notifyActionError("Não foi possível salvar definição", e, "Tente novamente."),
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
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms-all"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
      ]);
      setTermInput("");
      notify.success("Termo adicionado", "A definição foi atualizada.");
    },
    onError: (e: any) => notifyActionError("Não foi possível adicionar termo", e, "Tente novamente."),
  });

  const removeTermMutation = useMutation({
    mutationFn: async (termId: string) => {
      const { error } = await supabase.from("alert_terms").delete().eq("id", termId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms-all"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
      ]);
      notify.success("Termo removido", "A definição foi atualizada.");
    },
    onError: (e: any) => notifyActionError("Não foi possível remover termo", e, "Tente novamente."),
  });

  const removeDefinitionMutation = useMutation({
    mutationFn: async (definitionId: string) => {
      const { error } = await supabase.from("alert_definitions").delete().eq("id", definitionId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts", "definitions"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "definitions-options"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "terms-all"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", "unread-count"] }),
      ]);
      notify.success("Definição removida", "Tudo certo.");
    },
    onError: (e: any) => notifyActionError("Não foi possível remover definição", e, "Tente novamente."),
  });

  const resetForm = useCallback(() => {
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
  }, [groupIds, groupsQuery.data, isOrgAdmin, isSystemAdmin, orgIds, orgsQuery.data]);

  useEffect(() => {
    if (!createOpen) {
      setEditing(null);
      resetForm();
    }
  }, [createOpen, resetForm]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const releaseStalePointerLock = () => {
      const hasAppModalOpen = createOpen || !!removeDefinition || !!removeTerm;
      if (hasAppModalOpen) return;

      if (document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
      if (document.documentElement.style.pointerEvents === "none") {
        document.documentElement.style.pointerEvents = "";
      }
    };

    releaseStalePointerLock();

    const observer = new MutationObserver(() => {
      releaseStalePointerLock();
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });

    const onWindowFocus = () => releaseStalePointerLock();
    const onPointerDownCapture = () => releaseStalePointerLock();
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("pointerdown", onPointerDownCapture, true);

    const timeoutId = window.setTimeout(releaseStalePointerLock, 0);

    return () => {
      observer.disconnect();
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.clearTimeout(timeoutId);
      releaseStalePointerLock();
    };
  }, [createOpen, removeDefinition, removeTerm]);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!isAuthenticated || !canUseAlerts) return;
    const shouldRedirect = isDefinitionsPage
      ? shouldRedirectAlertDefinitionsPath({ pathname: location.pathname, isSystemAdmin })
      : shouldRedirectAlertsPath({ pathname: location.pathname, isSystemAdmin });
    if (!shouldRedirect) return;
    navigate(
      `${isDefinitionsPage ? canonicalAlertDefinitionsPath : canonicalAlertsPath}${location.search}${location.hash}`,
      { replace: true },
    );
  }, [
    authLoading,
    canUseAlerts,
    canonicalAlertDefinitionsPath,
    canonicalAlertsPath,
    isAuthenticated,
    isDefinitionsPage,
    isSystemAdmin,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    rolesLoading,
  ]);

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
      notifyValidation.fieldRequired("Informe um nome.");
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
      notifyValidation.fieldRequired("Selecione uma organização.");
      return;
    }
    if (formScopeType === "group" && !group_id) {
      notifyValidation.fieldRequired("Selecione um grupo.");
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
      const termFailures: string[] = [];
      for (const rawTerm of termDrafts) {
        try {
          await addTermMutation.mutateAsync({ definitionId: saved.id, raw: rawTerm });
        } catch {
          termFailures.push(rawTerm);
        }
      }
      if (termFailures.length) {
        notify.error(
          termFailures.length === termDrafts.length
            ? "Definição salva, mas nenhum termo foi adicionado."
            : `Definição salva, mas ${termFailures.length} termo(s) falharam ao adicionar.`,
        );
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

  const isWindowMode = formMatchMode === "WINDOW";

  const showClearFilters =
    statusFilter !== "unread" ||
    groupFilter !== "all" ||
    definitionFilter !== "all" ||
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
      className: "w-[110px] align-top",
      sortable: true,
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
      key: "alert",
      header: "Alerta",
      sortable: true,
      sortValue: (ev) => `${ev.alert_terms?.term_raw ?? ""} ${ev.groups?.name ?? ""} ${ev.alert_definitions?.name ?? ""}`,
      render: (ev) => (
        <div className="min-w-0 py-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{ev.alert_terms?.term_raw ?? "Sem termo"}</span>
            <span className="text-xs text-muted-foreground">
              em {ev.groups?.name ?? "grupo não identificado"}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {ev.alert_definitions?.name ?? "Definição sem nome"}
          </div>
          <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {ev.snippet ?? "Sem trecho disponível para esta ocorrência."}
          </div>
        </div>
      ),
    },
    {
      key: "last_activity",
      header: "Última atividade",
      className: "w-[180px] align-top",
      sortable: true,
      sortValue: (ev) => ev.last_triggered_at,
      render: (ev) => (
        <div className="py-1 text-sm">
          <div className="tabular-nums font-medium text-foreground">{formatDateTimeBR(ev.last_triggered_at)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {ev.occurrences} ocorrência{ev.occurrences === 1 ? "" : "s"}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-0 align-top text-right",
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
            disabled={ev.status === "unread"}
            onSelect={() => {
              if (ev.status !== "unread") markUnreadMutation.mutate(ev.id);
            }}
          >
            Marcar como não lido
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              navigate(
                ev.last_message_id
                  ? `/groups/${ev.group_id}/messages?messageId=${encodeURIComponent(ev.last_message_id)}`
                  : `/groups/${ev.group_id}/messages`,
              );
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
                .then(() => notify.success("Alerta arquivado", "Ele foi removido da lista ativa."))
                .catch((e: any) => notifyActionError("Não foi possível arquivar alerta", e, "Tente novamente."));
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
      header: "Regra",
      sortable: true,
      render: (definition) => <span className="font-medium">{definition.name}</span>,
    },
    {
      key: "scope",
      header: "Onde vale",
      sortable: true,
      sortValue: (definition) => {
        const scope = deriveScopeType(definition);
        if (scope === "system") return "Sistema inteiro";
        if (scope === "org") return orgsQuery.data?.find((org) => org.id === definition.organization_id)?.name ?? "Organização";
        return groupsQuery.data?.find((group) => group.id === definition.group_id)?.name ?? "Grupo";
      },
      render: (definition) => {
        const scope = deriveScopeType(definition);
        if (scope === "system") return <span className="text-muted-foreground">Sistema inteiro</span>;
        if (scope === "org") {
          const orgName = orgsQuery.data?.find((org) => org.id === definition.organization_id)?.name;
          return <span className="text-muted-foreground">{orgName ? `Organização: ${orgName}` : "Organização"}</span>;
        }
        const groupName = groupsQuery.data?.find((group) => group.id === definition.group_id)?.name;
        return <span className="text-muted-foreground">{groupName ? `Grupo: ${groupName}` : "Grupo"}</span>;
      },
    },
    {
      key: "terms",
      header: "Termos",
      className: "w-[90px] text-right",
      align: "right",
      sortable: true,
      sortValue: (definition) => termsByDefinition.get(definition.id)?.length ?? 0,
      render: (definition) => (
        <span className="tabular-nums text-muted-foreground">{termsByDefinition.get(definition.id)?.length ?? 0}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[110px]",
      sortable: true,
      render: (definition) => (
        <span
          className={
            definition.status === "active"
              ? "inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
              : "inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
          }
        >
          {definition.status === "active" ? "Ativa" : "Inativa"}
        </span>
      ),
    },
    {
      key: "updated_at",
      header: "Atualizada",
      className: "w-[180px]",
      sortable: true,
      render: (definition) => <span className="tabular-nums text-muted-foreground">{formatDateTimeBR(definition.updated_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-0 text-right",
      render: (definition) => (
        <RowActions>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              openEdit(definition);
            }}
          >
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setTab("events");
              setStatusFilter("unread");
              setDefinitionFilter(definition.id);
              setEventsPage(1);
              notify.success("Filtro aplicado", "Mostrando os alertas dessa regra.");
            }}
          >
            Ver alertas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setRemoveDefinition(definition);
            }}
          >
            Excluir
          </DropdownMenuItem>
        </RowActions>
      ),
    },
  ];

  const currentUnread = unreadCountQuery.data ?? 0;
  const totalDefinitions = definitionsQuery.data?.total ?? 0;
  const totalTerms = allTermsQuery.data?.length ?? 0;
  const activeDefinitionsCount = definitionsQuery.data?.items.filter((definition) => definition.status === "active").length ?? 0;
  const activeFilterChips = [
    statusFilter !== "unread"
      ? { key: "status", label: `Status: ${statusFilter === "all" ? "Todos" : statusFilter === "read" ? "Lidos" : statusFilter === "archived" ? "Arquivados" : "Não lidos"}`, clear: () => setStatusFilter("unread") }
      : null,
    groupFilter !== "all"
      ? {
          key: "group",
          label: `Grupo: ${(groupsQuery.data ?? []).find((g) => g.id === groupFilter)?.name ?? "Selecionado"}`,
          clear: () => setGroupFilter("all"),
        }
      : null,
    definitionFilter !== "all"
      ? {
          key: "definition",
          label: `Definição: ${(definitionsOptionsQuery.data ?? []).find((d) => d.id === definitionFilter)?.name ?? "Selecionada"}`,
          clear: () => setDefinitionFilter("all"),
        }
      : null,
    termFilter !== "all"
      ? {
          key: "term",
          label: `Termo: ${availableTerms.find((t) => t.id === termFilter)?.label ?? "Selecionado"}`,
          clear: () => setTermFilter("all"),
        }
      : null,
    search.trim()
      ? { key: "search", label: `Busca: ${search.trim()}`, clear: () => setSearch("") }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  return (
    <AdminLayout title="Alertas" subtitle="Acompanhe alertas e ajuste regras de monitoramento">
      <div className="mx-auto max-w-[1480px] space-y-6 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[
            { label: "Central de Comando", href: "/" },
            { label: isDefinitionsPage ? "Definições de alerta" : "Alertas" },
          ]}
          title={isDefinitionsPage ? "Definições de alerta" : "Alertas"}
          description={isDefinitionsPage ? "Ajuste as regras que geram alertas" : "Veja o que precisa de atenção"}
          actions={(
            <div className="flex items-center gap-2">
              {isDefinitionsPage ? (
                <>
                  <Button variant="outline" onClick={() => navigate(canonicalAlertsPath)}>
                    <Bell className="h-4 w-4 mr-1" />
                    Ver alertas
                  </Button>
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1" />
                    Nova definição
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => navigate(canonicalAlertDefinitionsPath)}>
                    <Settings className="h-4 w-4 mr-1" />
                    Ver definições
                  </Button>
                  <Button variant="outline" onClick={() => markAllReadMutation.mutate()} disabled={currentUnread === 0}>
                    <Bell className="h-4 w-4 mr-1" />
                    Marcar tudo como lido
                  </Button>
                </>
              )}
            </div>
          )}
          filters={!isDefinitionsPage ? (
            <div className="min-w-0 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Filter className="h-4 w-4 text-primary" />
                  Filtros
                </div>
                <p className="text-xs text-muted-foreground">
                  Use só o necessário para encontrar um alerta.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Status</div>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v as any);
                      setEventsPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unread">Não lidos</SelectItem>
                      <SelectItem value="read">Lidos</SelectItem>
                      <SelectItem value="archived">Arquivados</SelectItem>
                      <SelectItem value="all">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Buscar na mensagem</div>
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setEventsPage(1);
                      }}
                      placeholder="Ex.: pix, erro, suporte"
                      className="w-full pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : undefined}
          showClearFilters={!isDefinitionsPage && showClearFilters}
          onClearFilters={() => {
            setStatusFilter("unread");
            setGroupFilter("all");
            setDefinitionFilter("all");
            setTermFilter("all");
            setSearch("");
            setEventsPage(1);
          }}
        />

        {!isDefinitionsPage ? (
        <section className="space-y-4">
          <Card className="border-border/80 shadow-subtle">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground">Centro de alertas</div>
                  <p className="text-xs text-muted-foreground">
                    {eventsQuery.data?.total ?? 0} alerta(s) encontrados.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-primary/20 bg-primary/10 text-primary">
                    {statusFilter === "all"
                      ? "Todos os status"
                      : statusFilter === "unread"
                        ? "Somente não lidos"
                        : statusFilter === "read"
                          ? "Somente lidos"
                          : "Somente arquivados"}
                  </Badge>
                  {currentUnread > 0 ? (
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      {currentUnread} não lido(s)
                    </span>
                  ) : null}
                </div>
              </div>

              {activeFilterChips.length > 0 ? (
                <FilterChips
                  className="mt-3"
                  items={activeFilterChips.map((chip) => ({
                    key: chip.key,
                    label: chip.label,
                    onRemove: () => {
                      chip.clear();
                      setEventsPage(1);
                    },
                  }))}
                />
              ) : (
                <div className="mt-3 text-xs text-muted-foreground">
                  Nenhum filtro extra ativo. A lista abaixo mostra os alertas conforme o status escolhido.
                </div>
              )}
            </CardContent>
          </Card>

          <BorisTable
            columns={eventColumns as any}
            data={eventsQuery.data?.items ?? []}
            keyExtractor={(e) => e.id}
            density="comfortable"
            rowClassName={(e) => (e.status === "unread" ? "bg-primary/5" : undefined)}
            page={eventsPage}
            pageSize={EVENTS_PAGE_SIZE}
            totalCount={eventsQuery.data?.total}
            onPageChange={setEventsPage}
            loading={eventsQuery.isLoading}
            error={!!eventsQuery.error}
            emptyIcon={AlertTriangle}
            emptyMessage="Nenhum alerta encontrado."
            onRowClick={(e) => {
              if (e.status === "unread") markReadMutation.mutate(e.id);
              navigate(
                e.last_message_id
                  ? `/groups/${e.group_id}/messages?messageId=${encodeURIComponent(e.last_message_id)}`
                  : `/groups/${e.group_id}/messages`,
              );
            }}
          />
        </section>
        ) : null}

        {isDefinitionsPage ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border/80 bg-card/95 px-4 py-3 shadow-subtle sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground">Definições</div>
              <p className="text-xs text-muted-foreground">
                Escolha o que realmente deve gerar alerta.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              {activeDefinitionsCount} ativa(s) • {totalTerms} termos
            </div>
          </div>

          <BorisTable
            columns={definitionColumns as any}
            data={definitionsQuery.data?.items ?? []}
            keyExtractor={(definition) => definition.id}
            page={definitionsPage}
            pageSize={DEFINITIONS_PAGE_SIZE}
            totalCount={definitionsQuery.data?.total}
            onPageChange={setDefinitionsPage}
            loading={definitionsQuery.isLoading}
            error={!!definitionsQuery.error}
            emptyIcon={Settings}
            emptyMessage="Você ainda não tem regras cadastradas."
          />
        </section>
        ) : null}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        {createOpen ? (
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
                <p className="text-xs text-muted-foreground">
                  {isWindowMode
                    ? "Agrupa ocorrências próximas no tempo em um único alerta."
                    : "Cria um alerta para cada mensagem que bater no termo."}
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Janela (seg)</div>
                <Input
                  type="number"
                  value={String(formDedupeWindowSec)}
                  onChange={(e) => setFormDedupeWindowSec(Number(e.target.value))}
                  min={0}
                  disabled={!isWindowMode}
                />
                <p className="text-xs text-muted-foreground">
                  {isWindowMode ? "Tempo de agrupamento/anti-duplicação no modo Janela." : "Ignorado no modo Por mensagem."}
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Notificar no Admin</div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                  <Switch checked={formNotifyInApp} onCheckedChange={setFormNotifyInApp} />
                  <span className="text-sm text-muted-foreground">{formNotifyInApp ? "Habilitado" : "Desabilitado"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quando desativado, a regra continua salva mas não gera alertas no painel.
                </p>
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
                    <p className="mb-3 text-xs text-muted-foreground">
                      Clique em um termo para remover. O sistema compara texto normalizado (sem acento/pontuação).
                    </p>
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
                <p className="text-xs text-muted-foreground">
                  Separe por vírgula ou Enter. Você pode remover termos antes de salvar.
                </p>
                {termDrafts.length ? (
                  <div className="flex flex-wrap gap-2">
                    {termDrafts.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-3 py-1 text-sm"
                        onClick={() => setTermDrafts((prev) => prev.filter((item) => item !== t))}
                        title="Remover termo"
                      >
                        <span>{t}</span>
                        <span className="text-xs text-muted-foreground">remover</span>
                      </button>
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
        ) : null}
      </Dialog>

      <AlertDialog open={!!removeDefinition} onOpenChange={(open) => !open && setRemoveDefinition(null)}>
        {removeDefinition ? (
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
        ) : null}
      </AlertDialog>

      <AlertDialog open={!!removeTerm} onOpenChange={(open) => !open && setRemoveTerm(null)}>
        {removeTerm ? (
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
        ) : null}
      </AlertDialog>
    </AdminLayout>
  );
}
