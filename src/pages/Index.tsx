import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ExecutiveSectionHeader } from "@/components/dashboard/ExecutiveSectionHeader";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
 
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { Activity, Layers, Users as UsersIcon, MessageSquare, ChevronRight, ArrowUp } from "lucide-react";
import {
  PeriodType,
  getDateRange,
} from "@/components/group-dashboard/period-utils";
 
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { SAO_PAULO_TZ } from "@/lib/date";
import { getPostLoginRedirectPath } from "@/lib/auth-routing";
import { buildParticipationChange, buildSystemDaySummary } from "./index-dashboard-utils";

type RecentGroupRow = {
  id: string;
  name: string;
  created_at: string;
  organization_id: string;
  organizations?: { name: string } | null;
};

type NewGroup24hCard = RecentGroupRow & {
  messages24h: number;
  firstActivityAt: string | null;
  createdHoursAgo: number;
  status: "new" | "active" | "idle";
};

type SignalConcentrationTopGroup = {
  id: string;
  name: string;
  count: number;
  activeMembers: number;
};

type SignalConcentrationPayload = {
  groupId: string;
  groupName: string;
  share: number;
  topGroups: SignalConcentrationTopGroup[];
  totalMessages: number;
  activeGroups: number;
} | null;

type PeriodKpiSummary = {
  totalMessages: number;
  activeGroups: number;
  activeOrganizations: number;
  activeMembers: number;
};

type SystemTotalsSummary = {
  organizations: number;
  groups: number;
  messages: number;
};

const NEW_GROUPS_24H_LIST_LIMIT = 10;
const TOP_GROUPS_24H_LIMIT = 10;

const Index = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    isLoading: rolesLoading,
    isSystemAdmin,
    getAccessibleOrgIds,
    getAccessibleGroupIds,
  } = useUserRoles();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!authLoading && !rolesLoading && isAuthenticated && !isSystemAdmin) {
      const groups = getAccessibleGroupIds();
      const orgs = getAccessibleOrgIds();
      const redirectPath = getPostLoginRedirectPath({
        isSystemAdmin,
        groupIds: groups ?? [],
        orgIds: orgs ?? [],
      });
      if (redirectPath) navigate(redirectPath, { replace: true });
    }
  }, [authLoading, rolesLoading, isAuthenticated, isSystemAdmin, getAccessibleGroupIds, getAccessibleOrgIds, navigate]);

  const selectedPeriod: PeriodType = "30d";
  const currentRange = useMemo(
    () => getDateRange(selectedPeriod),
    [selectedPeriod],
  );

  const formatNumberBR = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
  const formatTimeBR = (date: Date) => formatInTimeZone(date, SAO_PAULO_TZ, "HH:mm");

  const [showBackToTop, setShowBackToTop] = useState(false);
  const trackDashboardInteraction = (action: string, metadata: Record<string, unknown> = {}) => {
    try {
      const key = "boris_system_dashboard_interactions_v1";
      const raw = localStorage.getItem(key);
      const current = raw ? JSON.parse(raw) : {};
      const events = Array.isArray(current?.events) ? current.events.slice(-49) : [];
      events.push({
        action,
        metadata,
        at: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify({ events }));
    } catch {
      void 0;
    }
  };

  useEffect(() => {
    let raf = 0;
    const handleScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const doc = document.documentElement;
        const scrollTop = window.scrollY || doc.scrollTop || 0;
        setShowBackToTop(scrollTop > 640);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const comparisonNowTick = selectedPeriod === "today" ? Math.floor(Date.now() / 300_000) : 0;
  const comparisonRange = useMemo(() => {
    const now = selectedPeriod === "today" ? new Date(comparisonNowTick * 300_000) : new Date();
    let currTo = currentRange.to;
    let prevFrom: Date;
    let prevTo: Date;
    const startOfDaySP = (date: Date) => {
      const dStr = formatInTimeZone(date, SAO_PAULO_TZ, 'yyyy-MM-dd');
      return fromZonedTime(`${dStr}T00:00:00`, SAO_PAULO_TZ);
    };
    const endOfDaySP = (date: Date) => {
      const dStr = formatInTimeZone(date, SAO_PAULO_TZ, 'yyyy-MM-dd');
      return fromZonedTime(`${dStr}T23:59:59`, SAO_PAULO_TZ);
    };
    if (selectedPeriod === 'today') {
      currTo = now;
      const yesterdayStart = startOfDaySP(addDays(now, -1));
      const todayStart = startOfDaySP(now);
      const elapsedMs = Math.max(0, currTo.getTime() - todayStart.getTime());
      prevFrom = yesterdayStart;
      prevTo = new Date(yesterdayStart.getTime() + elapsedMs);
    } else if (selectedPeriod === 'yesterday') {
      const anteontemStart = startOfDaySP(addDays(currentRange.from, -1));
      prevFrom = anteontemStart;
      prevTo = endOfDaySP(addDays(currentRange.from, -1));
    } else {
      const lengthMs = Math.max(0, currentRange.to.getTime() - currentRange.from.getTime());
      prevTo = new Date(currentRange.from.getTime() - 1);
      prevFrom = new Date(prevTo.getTime() - lengthMs);
    }
    return { prevFrom, prevTo };
  }, [comparisonNowTick, currentRange.from, currentRange.to, selectedPeriod]);

  const { prevFrom, prevTo } = comparisonRange;
  const prevStartISO = prevFrom.toISOString();
  const prevEndISO = prevTo.toISOString();

  const last24hTick = Math.floor(Date.now() / 300_000);
  const { last24hStartISO, last24hEndISO, last24hNow } = useMemo(() => {
    const end = new Date(last24hTick * 300_000);
    const start = new Date(end.getTime() - 86_400_000);
    return {
      last24hStartISO: start.toISOString(),
      last24hEndISO: end.toISOString(),
      last24hNow: end,
    };
  }, [last24hTick]);

  const fetchTotalMembersCount = async () => {
    const { count, error } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);
    if (error) throw error;
    return count ?? 0;
  };

  const fetchMembersCountAsOf = async (asOfISO: string) => {
    const { count, error } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .lte("created_at", asOfISO)
      .or(`deleted_at.is.null,deleted_at.gt.${asOfISO}`);
    if (error) throw error;
    return count ?? 0;
  };

  const fetchSystemTotals = async (): Promise<SystemTotalsSummary> => {
    const [orgsRes, groupsRes, messagesRes] = await Promise.all([
      supabase.from("organizations").select("id", { count: "exact", head: true }),
      supabase.from("groups").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("messages").select("id", { count: "exact", head: true }).is("deleted_at", null),
    ]);

    if (orgsRes.error) throw orgsRes.error;
    if (groupsRes.error) throw groupsRes.error;
    if (messagesRes.error) throw messagesRes.error;

    return {
      organizations: orgsRes.count ?? 0,
      groups: groupsRes.count ?? 0,
      messages: messagesRes.count ?? 0,
    };
  };

  const isMissingRpcFunctionError = (error: unknown) => {
    const code = String((error as { code?: string } | null)?.code ?? "");
    const message = String((error as { message?: string } | null)?.message ?? "");
    return code === "42883" || /function .*get_system_dashboard_kpis/i.test(message);
  };

  const fetchPeriodKpiSummary = async (startISO: string, endISO: string): Promise<PeriodKpiSummary> => {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_system_dashboard_kpis", {
      p_start: startISO,
      p_end: endISO,
    });

    if (!rpcError) {
      const payload = (rpcData ?? {}) as Partial<PeriodKpiSummary>;
      return {
        totalMessages: Number(payload.totalMessages ?? 0),
        activeGroups: Number(payload.activeGroups ?? 0),
        activeOrganizations: Number(payload.activeOrganizations ?? 0),
        activeMembers: Number(payload.activeMembers ?? 0),
      };
    }

    if (!isMissingRpcFunctionError(rpcError)) {
      throw rpcError;
    }

    const { data: messageRows, error: msgErr } = await supabase
      .from("messages")
      .select("group_id, member_id")
      .is("deleted_at", null)
      .gte("created_at", startISO)
      .lte("created_at", endISO);
    if (msgErr) throw msgErr;

    const rows = (messageRows ?? []) as Array<{ group_id: string | null; member_id: string | null }>;
    const groupIds = Array.from(new Set(rows.map((r) => r.group_id).filter(Boolean))) as string[];
    const activeMembers = new Set(rows.map((r) => r.member_id).filter(Boolean)).size;

    let activeOrganizations = 0;
    if (groupIds.length > 0) {
      const { data: groupsData, error: grpErr } = await supabase
        .from("groups")
        .select("id, organization_id")
        .in("id", groupIds);
      if (grpErr) throw grpErr;
      activeOrganizations = new Set(
        ((groupsData ?? []) as Array<{ organization_id: string | null }>)
          .map((g) => g.organization_id)
          .filter(Boolean),
      ).size;
    }

    return {
      totalMessages: rows.length,
      activeGroups: groupIds.length,
      activeOrganizations,
      activeMembers,
    };
  };

  const fetchNewGroups24h = async () => {
    const { data, error } = await supabase
      .from("groups")
      .select("id, name, created_at, organization_id, organizations(name)")
      .is("deleted_at", null)
      .or("is_archived.eq.false,is_archived.is.null")
      .gte("created_at", last24hStartISO)
      .lte("created_at", last24hEndISO)
      .order("created_at", { ascending: false })
      .limit(NEW_GROUPS_24H_LIST_LIMIT);
    if (error) throw error;

    const groups = (data ?? []) as RecentGroupRow[];
    const groupIds = groups.map((g) => g.id);
    if (groupIds.length === 0) return [] as NewGroup24hCard[];

    const { data: msgData, error: msgErr } = await supabase
      .from("messages")
      .select("group_id, created_at")
      .is("deleted_at", null)
      .in("group_id", groupIds)
      .gte("created_at", last24hStartISO)
      .lte("created_at", last24hEndISO);
    if (msgErr) throw msgErr;

    const metrics = new Map<string, { count: number; firstActivityAt: string | null }>();
    groupIds.forEach((id) => metrics.set(id, { count: 0, firstActivityAt: null }));
    (msgData ?? []).forEach((row: any) => {
      const id = String(row.group_id || "");
      if (!metrics.has(id)) return;
      const entry = metrics.get(id)!;
      entry.count += 1;
      const ts = String(row.created_at || "");
      if (!entry.firstActivityAt || ts < entry.firstActivityAt) entry.firstActivityAt = ts;
    });

    const recentlyIncludedHours = 3;

    return groups.map((g) => {
      const createdMs = new Date(g.created_at).getTime();
      const createdHoursAgo = Number.isFinite(createdMs)
        ? Math.max(0, Math.round((last24hNow.getTime() - createdMs) / 3_600_000))
        : 0;
      const entry = metrics.get(g.id) ?? { count: 0, firstActivityAt: null };
      const messages24h = entry.count;

      const status: NewGroup24hCard["status"] = messages24h > 0
        ? "active"
        : createdHoursAgo <= recentlyIncludedHours
          ? "new"
          : "idle";

      return {
        ...g,
        messages24h,
        firstActivityAt: entry.firstActivityAt,
        createdHoursAgo,
        status,
      };
    });
  };

  const fetchNewGroups24hCount = async () => {
    const { count, error } = await supabase
      .from("groups")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .or("is_archived.eq.false,is_archived.is.null")
      .gte("created_at", last24hStartISO)
      .lte("created_at", last24hEndISO);
    if (error) throw error;
    return count ?? 0;
  };

  const {
    data: kpiMembers,
    isLoading: kpiMembersLoading,
    error: kpiMembersError,
  } = useQuery({
    queryKey: ["kpi-members-total"],
    queryFn: fetchTotalMembersCount,
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: systemTotals,
    isLoading: systemTotalsLoading,
    error: systemTotalsError,
  } = useQuery({
    queryKey: ["system-totals-summary"],
    queryFn: fetchSystemTotals,
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: kpiMembersPrevBase,
    isLoading: kpiMembersPrevBaseLoading,
    error: kpiMembersPrevBaseError,
  } = useQuery({
    queryKey: ["kpi-members-total-as-of", prevEndISO],
    queryFn: () => fetchMembersCountAsOf(prevEndISO),
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: newGroups24h,
    isLoading: newGroups24hLoading,
    error: newGroups24hError,
  } = useQuery({
    queryKey: ["system-new-groups-24h", last24hStartISO, last24hEndISO, NEW_GROUPS_24H_LIST_LIMIT],
    queryFn: fetchNewGroups24h,
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: newGroups24hCount,
    isLoading: newGroups24hCountLoading,
    error: newGroups24hCountError,
  } = useQuery({
    queryKey: ["system-new-groups-24h-count", last24hStartISO, last24hEndISO],
    queryFn: fetchNewGroups24hCount,
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: currentPeriodKpis,
    isLoading: currentPeriodKpisLoading,
    error: currentPeriodKpisError,
  } = useQuery({
    queryKey: ["kpi-summary-period", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: () => fetchPeriodKpiSummary(currentRange.from.toISOString(), currentRange.to.toISOString()),
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: prevPeriodKpis,
    isLoading: prevPeriodKpisLoading,
    error: prevPeriodKpisError,
  } = useQuery({
    queryKey: ["kpi-summary-prev-period", prevStartISO, prevEndISO],
    queryFn: () => fetchPeriodKpiSummary(prevStartISO, prevEndISO),
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const kpiMessagesPeriod = currentPeriodKpis?.totalMessages;
  const kpiGroupsPeriod = currentPeriodKpis?.activeGroups;
  const kpiOrgsPeriod = currentPeriodKpis?.activeOrganizations;
  const kpiActiveMembersPeriod = currentPeriodKpis?.activeMembers;
  const kpiMessagesPrevPeriod = prevPeriodKpis?.totalMessages;
  const kpiGroupsPrevPeriod = prevPeriodKpis?.activeGroups;
  const kpiOrgsPrevPeriod = prevPeriodKpis?.activeOrganizations;
  const kpiActiveMembersPrevPeriod = prevPeriodKpis?.activeMembers;
  const kpiMessagesLoading = currentPeriodKpisLoading;
  const kpiGroupsPeriodLoading = currentPeriodKpisLoading;
  const kpiOrgsPeriodLoading = currentPeriodKpisLoading;
  const kpiActiveMembersLoading = currentPeriodKpisLoading;
  const kpiMessagesError = currentPeriodKpisError;
  const kpiGroupsPeriodError = currentPeriodKpisError;
  const kpiOrgsPeriodError = currentPeriodKpisError;
  const kpiActiveMembersError = currentPeriodKpisError;
  const lastKpiErrorToastKeyRef = useRef<string>("");

  useEffect(() => {
    const key = JSON.stringify({
      kpiMembersError: Boolean(kpiMembersError),
      kpiMembersPrevBaseError: Boolean(kpiMembersPrevBaseError),
      currentPeriodKpisError: Boolean(currentPeriodKpisError),
      prevPeriodKpisError: Boolean(prevPeriodKpisError),
      systemTotalsError: Boolean(systemTotalsError),
    });

    if (!(kpiMembersError || kpiMembersPrevBaseError || currentPeriodKpisError || prevPeriodKpisError || systemTotalsError)) {
      lastKpiErrorToastKeyRef.current = "";
      return;
    }

    if (lastKpiErrorToastKeyRef.current !== key) {
      lastKpiErrorToastKeyRef.current = key;
      notify.error("Alguns indicadores não puderam ser carregados", "Você ainda pode usar os blocos com dados disponíveis.");
    }
  }, [
    kpiMembersError,
    kpiMembersPrevBaseError,
    currentPeriodKpisError,
    prevPeriodKpisError,
    systemTotalsError,
  ]);


  const {
    data: pulse24h,
    isLoading: pulse24hLoading,
    error: pulse24hError,
    refetch: refetchPulse24h,
  } = useQuery({
    queryKey: ["signal-concentration-24h", last24hStartISO, last24hEndISO, TOP_GROUPS_24H_LIMIT],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_system_signal_concentration", {
        p_start: last24hStartISO,
        p_end: last24hEndISO,
        p_limit: TOP_GROUPS_24H_LIMIT,
      });
      if (error) throw error;
      return data as unknown as SignalConcentrationPayload;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  useEffect(() => {
    if (!isAuthenticated || !isSystemAdmin) return;
    if (typeof (supabase as any).channel !== "function") return;

    let refreshTimer: number | null = null;
    const scheduleSystemRefresh = () => {
      if (refreshTimer !== null) return;
      refreshTimer = globalThis.setTimeout(() => {
        refreshTimer = null;
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["kpi-members-total"] }),
          queryClient.invalidateQueries({ queryKey: ["system-totals-summary"] }),
          queryClient.invalidateQueries({ queryKey: ["system-new-groups-24h"] }),
          queryClient.invalidateQueries({ queryKey: ["system-new-groups-24h-count"] }),
          queryClient.invalidateQueries({ queryKey: ["kpi-summary-period"] }),
          queryClient.invalidateQueries({ queryKey: ["kpi-summary-prev-period"] }),
          queryClient.invalidateQueries({ queryKey: ["signal-concentration-24h"] }),
        ]);
      }, 400);
    };

    const channel = supabase
      .channel("realtime:system-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "organizations" }, scheduleSystemRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, scheduleSystemRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, scheduleSystemRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, scheduleSystemRefresh)
      .subscribe();

    return () => {
      if (refreshTimer !== null) globalThis.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, isSystemAdmin, queryClient]);

  const describePercentChange = (delta: number, suffix: string) => {
    if (Math.abs(delta) <= 2) return `Estável em relação ao ${suffix}`;
    if (delta > 0) return `Subiu ${delta}% em relação ao ${suffix}`;
    return `Caiu ${Math.abs(delta)}% em relação ao ${suffix}`;
  };

  const describeAbsoluteChange = (abs: number, singular: string, plural: string, suffix: string) => {
    if (abs === 0) return `Estável em relação ao ${suffix}`;
    const unit = Math.abs(abs) === 1 ? singular : plural;
    if (abs > 0) return `${abs} ${unit} a mais que o ${suffix}`;
    return `${Math.abs(abs)} ${unit} a menos que o ${suffix}`;
  };

  const messagesDelta = (() => {
    const curr = kpiMessagesPeriod || 0;
    const prev = kpiMessagesPrevPeriod ?? null;
    if (prev === null) return null;
    if (prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  })();
  const messagesChangeLabel = (() => {
    const prev = kpiMessagesPrevPeriod ?? null;
    if (prev === null) return "—";
    const curr = kpiMessagesPeriod || 0;
    if (curr === prev) return "Estável";
    if (prev === 0) return curr > 0 ? "Sem histórico anterior para comparar" : "Estável";
    const d = messagesDelta as number;
    return describePercentChange(d, "período anterior");
  })();
  const messagesChangeType = (() => {
    const prev = kpiMessagesPrevPeriod ?? null;
    if (prev === null) return "neutral" as const;
    const curr = kpiMessagesPeriod || 0;
    if (curr === prev) return "neutral" as const;
    if (prev === 0) return curr > 0 ? ("positive" as const) : ("neutral" as const);
    const d = messagesDelta as number;
    if (Math.abs(d) <= 2) return "neutral" as const;
    return d > 0 ? "positive" as const : "negative" as const;
  })();

  const participationValue = (() => { if (kpiActiveMembersLoading || kpiMembersLoading) return "—"; const total = kpiMembers || 0; const actives = kpiActiveMembersPeriod || 0; if (!total) return "0%"; return String(Math.round((actives / total) * 100)) + "%"; })();

  const orgsChange = (() => {
    const curr = kpiOrgsPeriod || 0;
    const prev = kpiOrgsPrevPeriod ?? null;
    if (prev === null) return { label: "—", type: "neutral" as const };
    const abs = curr - prev;
    return { label: describeAbsoluteChange(abs, "organização", "organizações", "período anterior"), type: abs > 0 ? "positive" as const : abs < 0 ? "negative" as const : "neutral" as const };
  })();

  const groupsChange = (() => {
    const curr = kpiGroupsPeriod || 0;
    const prev = kpiGroupsPrevPeriod ?? null;
    if (prev === null) return { label: "—", type: "neutral" as const };
    const abs = curr - prev;
    return { label: describeAbsoluteChange(abs, "grupo", "grupos", "período anterior"), type: abs > 0 ? "positive" as const : abs < 0 ? "negative" as const : "neutral" as const };
  })();

  const activeMembersChange = (() => {
    const curr = kpiActiveMembersPeriod || 0;
    const prev = kpiActiveMembersPrevPeriod ?? null;
    if (prev === null) return { label: "—", type: "neutral" as const };
    if (curr === prev) return { label: "Estável", type: "neutral" as const };
    if (prev === 0) return { label: "Sem histórico anterior para comparar", type: "positive" as const };
    const delta = Math.round(((curr - prev) / prev) * 100);
    const type = delta > 0 ? "positive" as const : "negative" as const;
    return { label: describePercentChange(delta, "período anterior"), type };
  })();

  const participationChange = (() => {
    return buildParticipationChange({
      currentTotalMembers: kpiMembers || 0,
      previousTotalMembers: kpiMembersPrevBase ?? null,
      currentActiveMembers: kpiActiveMembersPeriod || 0,
      previousActiveMembers: kpiActiveMembersPrevPeriod ?? null,
    });
  })();

  const pulseMeta = (() => {
    const totalMessages = Number(pulse24h?.totalMessages || 0);
    const activeGroups = Number(pulse24h?.activeGroups || 0);
    const top = pulse24h?.topGroups || [];
    const top4Messages = top.slice(0, 4).reduce((acc, g) => acc + Number(g.count || 0), 0);
    const top4Share = totalMessages ? top4Messages / totalMessages : 0;
    const sharePct = Math.round(top4Share * 100);
    const concentration = sharePct >= 65 ? "alta" : sharePct >= 45 ? "média" : "baixa";
    return { totalMessages, activeGroups, sharePct, concentration };
  })();

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Central de Comando" subtitle="Carregando...">
        <PageSkeleton />
      </AdminLayout>
    );
  }

  if (!isAuthenticated || !isSystemAdmin) {
    return null;
  }

  const daySummary = (() => {
    return buildSystemDaySummary({
      isLoading: newGroups24hLoading || newGroups24hCountLoading || pulse24hLoading,
      hasError: Boolean(newGroups24hError || newGroups24hCountError || pulse24hError),
      newGroupsCount: newGroups24hCount ?? newGroups24h?.length ?? 0,
      totalMessages: pulseMeta.totalMessages,
      activeGroups: pulseMeta.activeGroups,
      concentration: pulseMeta.concentration,
      formatNumber: formatNumberBR,
    });
  })();

  const mainKpis = (
    <>
      <StatsCard
        title="Mensagens totais"
        value={systemTotalsError ? "Erro" : String(systemTotals?.messages ?? 0)}
        isLoading={systemTotalsLoading}
        icon={MessageSquare}
        help={{
          whatIs: "Total acumulado de mensagens registradas em toda a base do sistema.",
          howToInterpret: "É um indicador histórico/cumulativo. Tende a crescer continuamente com o uso.",
          whatToObserve: "Use junto de ‘Mensagens (30d)’ para diferenciar tamanho da base de ritmo recente.",
        }}
        description="Mensagens acumuladas na base"
        variant="kpi"
        className="bg-gradient-to-b from-card to-card/90"
        titleClassName="text-muted-foreground/80"
        valueClassName="font-mono"
        numericValue
      />
      <StatsCard
        title="Mensagens (30d)"
        value={kpiMessagesError ? "Erro" : String(kpiMessagesPeriod ?? 0)}
        isLoading={kpiMessagesLoading}
        change={kpiMessagesLoading ? undefined : messagesChangeLabel}
        changeType={messagesChangeType}
        icon={MessageSquare}
        help={{
          whatIs: "Quantidade de mensagens enviadas no sistema nos últimos 30 dias.",
          howToInterpret: "Mostra o volume recente de uso. Compare com o período anterior para ver tendência.",
          whatToObserve: "Leia junto de membros ativos e participação para entender distribuição do volume.",
        }}
        description="Total de mensagens enviadas nos últimos 30 dias"
        variant="kpi"
        className="bg-gradient-to-b from-primary/[0.03] to-card"
        titleClassName="text-primary/80"
        valueClassName="font-mono text-primary"
        numericValue
      />
      <StatsCard
        title="Membros ativos (30d)"
        value={kpiActiveMembersError ? "Erro" : String(kpiActiveMembersPeriod ?? 0)}
        isLoading={kpiActiveMembersLoading}
        change={kpiActiveMembersLoading ? undefined : activeMembersChange.label}
        changeType={activeMembersChange.type}
        icon={UsersIcon}
        help={{
          whatIs: "Pessoas que enviaram ao menos uma mensagem no sistema nos últimos 30 dias.",
          howToInterpret: "Mede o tamanho da base realmente ativa no período.",
          whatToObserve: "Compare com participação (%) para avaliar alcance relativo do uso.",
        }}
        description="Pessoas que enviaram pelo menos 1 mensagem nos últimos 30 dias"
        variant="kpi"
        className="bg-gradient-to-b from-card to-card/90"
        titleClassName="text-muted-foreground/80"
        valueClassName="font-mono"
        numericValue
      />
      <StatsCard
        title="Participação (30d)"
        value={participationValue}
        isLoading={kpiActiveMembersLoading || kpiMembersLoading}
        change={participationChange.label}
        changeType={participationChange.type}
        icon={UsersIcon}
        help={{
          whatIs: "Percentual de membros do sistema que participaram com mensagem nos últimos 30 dias.",
          howToInterpret: "Mostra engajamento relativo da base. Valores maiores indicam maior alcance de participação.",
          whatToObserve: "Observe tendência e leia em conjunto com o volume de mensagens.",
        }}
        description="Percentual de membros que participaram com mensagem nos últimos 30 dias"
        variant="kpi"
        className="bg-gradient-to-b from-primary/[0.03] to-card"
        titleClassName="text-primary/80"
        valueClassName="font-mono text-primary"
        numericValue
      />
      <StatsCard
        title="Organizações"
        value={systemTotalsError ? "Erro" : String(systemTotals?.organizations ?? 0)}
        isLoading={systemTotalsLoading}
        icon={Activity}
        help={{
          whatIs: "Quantidade total de organizações cadastradas no Bóris.",
          howToInterpret: "Mostra a escala da base de organizações na plataforma.",
          whatToObserve: "Compare com grupos para acompanhar expansão estrutural.",
        }}
        description="Quantidade total de organizações"
        variant="kpi"
        className="bg-gradient-to-b from-card to-card/90"
        titleClassName="text-muted-foreground/80"
        valueClassName="font-mono"
        numericValue
      />
      <StatsCard
        title="Grupos"
        value={systemTotalsError ? "Erro" : String(systemTotals?.groups ?? 0)}
        isLoading={systemTotalsLoading}
        icon={Layers}
        help={{
          whatIs: "Quantidade total de grupos monitorados no sistema.",
          howToInterpret: "Mostra a escala operacional em número de grupos conectados.",
          whatToObserve: "Compare com mensagens e membros ativos para entender uso por grupo.",
        }}
        description="Quantidade total de grupos monitorados"
        variant="kpi"
        className="bg-gradient-to-b from-card to-card/90"
        titleClassName="text-muted-foreground/80"
        valueClassName="font-mono"
        numericValue
      />
    </>
  );

  return (
    <AdminLayout 
      title="Central de Comando" 
      subtitle="Panorama geral do Bóris"
    >
      <div className="space-y-10 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando" }]}
          title={(
            <>
              <span className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Panorama geral</span>
              <span className="ml-2 inline-flex h-6 items-center rounded-full border border-primary/20 bg-primary/[0.08] px-2.5 align-middle text-[11px] font-semibold text-primary">
                Sistema
              </span>
            </>
          )}
          description="Visão executiva do Bóris com sinais de uso recente, volume e alcance da base."
          className="mb-4"
          filters={(
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Badge variant="outline" className="h-5 border-primary/20 bg-primary/[0.04] px-2 text-[11px] font-medium text-primary/85">
                Visão geral do sistema
              </Badge>
              <Badge variant="outline" className="h-5 border-border/60 bg-background/70 px-2 text-[11px] font-medium text-muted-foreground">
                Base consolidada
              </Badge>
              <span className="text-xs sm:text-sm text-muted-foreground">
                Atualizado às <span className="font-mono text-[0.95em] font-medium text-foreground">{formatTimeBR(last24hNow)}</span> (BRT)
              </span>
            </div>
          )}
        />

        <section className="scroll-mt-32 rounded-2xl border border-primary/10 bg-gradient-to-b from-primary/[0.025] via-card to-card p-4 shadow-sm" id="executive-summary" aria-busy={newGroups24hLoading || newGroups24hCountLoading || pulse24hLoading ? "true" : undefined}>
          <ExecutiveSectionHeader
            eyebrow="Operação"
            eyebrowTone="primary"
            title="Resumo das últimas 24h"
            description="Leitura operacional rápida para decidir onde agir agora"
            icon={Activity}
            badge={(
              <Badge variant="outline" className="h-5 border-primary/20 bg-primary/[0.04] px-2 text-[11px] font-medium text-primary/85">
                Atualização contínua
              </Badge>
            )}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-primary/[0.02] p-4 lg:flex lg:h-[320px] lg:flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/85">Resumo operacional</p>
                <span className="text-[11px] font-medium text-primary/80">Período: 24h</span>
              </div>
              <div className="mt-3 lg:min-h-0 lg:flex-1">
                  <p className="text-[15px] leading-7 text-card-foreground lg:max-h-full lg:overflow-y-auto pr-1">
                    {daySummary}
                  </p>
                </div>
              </div>

            <div className="rounded-xl border border-border/60 bg-gradient-to-b from-muted/15 to-background/10 p-4 lg:flex lg:h-[320px] lg:flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Grupos mais movimentados</p>
                <Badge variant="outline" className="h-5 border-border/60 bg-background/60 px-2 text-[11px] text-muted-foreground">
                  {pulse24hLoading ? "—" : pulse24hError ? "indisponível" : `${pulseMeta.sharePct}%`} top 4
                </Badge>
              </div>

              {pulse24hLoading ? (
                <div className="mt-3 space-y-2" aria-live="polite" aria-busy="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card/50 p-2.5">
                      <Skeleton className="h-3 w-8/12" />
                      <Skeleton className="mt-2 h-3 w-6/12" />
                    </div>
                  ))}
                </div>
              ) : pulse24hError ? (
                <div className="mt-3">
                  <ErrorState title="Falha ao carregar" message="Não foi possível carregar o pulso das comunidades (24h)." retry={refetchPulse24h} />
                </div>
              ) : !pulse24h || !pulse24h.topGroups || pulse24h.topGroups.length === 0 ? (
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="text-sm font-medium text-card-foreground">Sem movimento suficiente</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ainda não há dados para destacar grupos.</p>
                </div>
              ) : (
                <div className="mt-3 flex min-h-0 flex-1 flex-col" aria-live="polite">
                  <p className="text-xs text-muted-foreground">
                    {formatNumberBR(pulseMeta.totalMessages)} mensagens em {formatNumberBR(pulseMeta.activeGroups)} grupos ativos.
                  </p>
                  <ScrollArea className="mt-2 min-h-0 lg:flex-1">
                    <div className="space-y-2 pr-3">
                      {pulse24h.topGroups.slice(0, TOP_GROUPS_24H_LIMIT).map((g, idx) => {
                        const count = Number(g.count || 0);
                        const share = pulseMeta.totalMessages ? Math.round((count / pulseMeta.totalMessages) * 100) : 0;
                        return (
                          <Link
                            key={g.id}
                            to={`/groups/${g.id}`}
                            onClick={() => trackDashboardInteraction("pulse_top_group_click", { groupId: g.id, rank: idx + 1 })}
                            className="ripple-surface group block rounded-lg border border-border/70 bg-card/50 px-3 py-2.5 transition-colors hover:bg-secondary/20"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-card-foreground truncate">{idx + 1}. {g.name}</p>
                                <p className="text-xs text-muted-foreground">{formatNumberBR(count)} mensagens • {share}%</p>
                              </div>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  {pulse24h.topGroups.length > TOP_GROUPS_24H_LIMIT ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Mostrando {TOP_GROUPS_24H_LIMIT} de {formatNumberBR(pulse24h.topGroups.length)} grupos.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="scroll-mt-32 rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/95 p-4 shadow-sm" id="kpis">
          <ExecutiveSectionHeader
            eyebrow="Base e Tendência"
            title="Indicadores principais (30d)"
            description="Números mais importantes no período escolhido para leitura de volume, alcance e crescimento."
            icon={Layers}
            badge={(
              <Badge variant="outline" className="h-5 px-2 text-[11px] font-medium text-muted-foreground">
                {ADMIN_MICROCOPY.labels.selectedPeriod}
              </Badge>
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-5 border-primary/20 bg-primary/[0.04] px-2 text-[11px] font-medium text-primary/85">
              Tendência e alcance
            </Badge>
            <span className="text-xs text-muted-foreground">
              Destaque para métricas recentes e indicadores de base para leitura rápida.
            </span>
          </div>
          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {mainKpis}
          </div>
          {kpiMembersError || kpiMembersPrevBaseError || currentPeriodKpisError || prevPeriodKpisError || systemTotalsError ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Alguns indicadores podem estar incompletos no momento. Tente atualizar a página em instantes.
            </p>
          ) : null}
        </section>

        {showBackToTop ? (
          <div className="fixed bottom-5 right-5 z-30">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Voltar ao topo"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="ripple-surface shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98] h-11 w-11"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}

      </div>
    </AdminLayout>
  );
};

export default Index;
