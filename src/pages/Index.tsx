import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ExecutiveSectionHeader } from "@/components/dashboard/ExecutiveSectionHeader";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
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
import { Activity, AlertTriangle, Layers, Users as UsersIcon, MessageSquare, ChevronRight, ArrowUp } from "lucide-react";
import {
  PeriodType,
  getDateRange,
} from "@/components/group-dashboard/period-utils";
 
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { SAO_PAULO_TZ } from "@/lib/date";
import { getPostLoginRedirectPath } from "@/lib/auth-routing";
import { buildParticipationChange } from "./index-dashboard-utils";

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

type OpenAiBillingAlertEvent = {
  id: string;
  created_at: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata: {
    operation?: string | null;
    group_id?: string | null;
    group_name?: string | null;
    target_date?: string | null;
    status?: number | null;
    body_excerpt?: string | null;
  } | null;
};

const NEW_GROUPS_24H_LIST_LIMIT = 10;
const TOP_GROUPS_24H_LIMIT = 5;
const LIVE_REFRESH_INTERVAL_MS = 60_000;

const Index = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    isLoading: rolesLoading,
    isSystemAdmin,
    isOrgAdmin,
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
        isOrgAdmin,
        groupIds: groups ?? [],
        orgIds: orgs ?? [],
      });
      if (redirectPath) navigate(redirectPath, { replace: true });
    }
  }, [authLoading, rolesLoading, isAuthenticated, isOrgAdmin, isSystemAdmin, getAccessibleGroupIds, getAccessibleOrgIds, navigate]);

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
  const { last24hStartISO, last24hEndISO, previous24hStartISO, previous24hEndISO, last24hNow } = useMemo(() => {
    const end = new Date(last24hTick * 300_000);
    const start = new Date(end.getTime() - 86_400_000);
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - 86_400_000);
    return {
      last24hStartISO: start.toISOString(),
      last24hEndISO: end.toISOString(),
      previous24hStartISO: previousStart.toISOString(),
      previous24hEndISO: previousEnd.toISOString(),
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

  const fetchRecentOpenAiBillingAlerts = async (): Promise<OpenAiBillingAlertEvent[]> => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("events")
      .select("id, created_at, event_type, entity_type, entity_id, metadata")
      .eq("event_type", "OPENAI_BILLING_ALERT")
      .eq("entity_type", "system")
      .eq("entity_id", "openai-billing")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;
    return (data ?? []) as OpenAiBillingAlertEvent[];
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
    dataUpdatedAt: kpiMembersUpdatedAt,
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
    dataUpdatedAt: systemTotalsUpdatedAt,
  } = useQuery({
    queryKey: ["system-totals-summary"],
    queryFn: fetchSystemTotals,
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: openAiBillingAlerts,
    isLoading: openAiBillingAlertsLoading,
    error: openAiBillingAlertsError,
  } = useQuery({
    queryKey: ["system-openai-billing-alerts"],
    queryFn: fetchRecentOpenAiBillingAlerts,
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
    refetchInterval: 60_000,
  });

  const {
    data: kpiMembersPrevBase,
    isLoading: kpiMembersPrevBaseLoading,
    error: kpiMembersPrevBaseError,
    dataUpdatedAt: kpiMembersPrevBaseUpdatedAt,
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
    dataUpdatedAt: newGroups24hUpdatedAt,
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
    dataUpdatedAt: newGroups24hCountUpdatedAt,
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
    dataUpdatedAt: currentPeriodKpisUpdatedAt,
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
    dataUpdatedAt: prevPeriodKpisUpdatedAt,
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
  const latestOpenAiBillingAlert = openAiBillingAlerts?.[0] ?? null;
  const latestOpenAiBillingMetadata = latestOpenAiBillingAlert?.metadata ?? null;
  const openAiBillingAlertCount = openAiBillingAlerts?.length ?? 0;

  useEffect(() => {
    const key = JSON.stringify({
      kpiMembersError: Boolean(kpiMembersError),
      kpiMembersPrevBaseError: Boolean(kpiMembersPrevBaseError),
      currentPeriodKpisError: Boolean(currentPeriodKpisError),
      prevPeriodKpisError: Boolean(prevPeriodKpisError),
      systemTotalsError: Boolean(systemTotalsError),
      openAiBillingAlertsError: Boolean(openAiBillingAlertsError),
    });

    if (!(kpiMembersError || kpiMembersPrevBaseError || currentPeriodKpisError || prevPeriodKpisError || systemTotalsError || openAiBillingAlertsError)) {
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
    openAiBillingAlertsError,
  ]);


  const {
    data: pulse24h,
    isLoading: pulse24hLoading,
    error: pulse24hError,
    refetch: refetchPulse24h,
    dataUpdatedAt: pulse24hUpdatedAt,
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
          queryClient.invalidateQueries({ queryKey: ["system-openai-billing-alerts"] }),
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
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, scheduleSystemRefresh)
      .subscribe();

    return () => {
      if (refreshTimer !== null) globalThis.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, isSystemAdmin, queryClient]);

  useEffect(() => {
    if (!isAuthenticated || !isSystemAdmin) return;

    const interval = globalThis.setInterval(() => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kpi-members-total"] }),
        queryClient.invalidateQueries({ queryKey: ["system-totals-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["system-new-groups-24h"] }),
        queryClient.invalidateQueries({ queryKey: ["system-new-groups-24h-count"] }),
        queryClient.invalidateQueries({ queryKey: ["kpi-summary-period"] }),
        queryClient.invalidateQueries({ queryKey: ["kpi-summary-prev-period"] }),
        queryClient.invalidateQueries({ queryKey: ["signal-concentration-24h"] }),
      ]);
    }, LIVE_REFRESH_INTERVAL_MS);

    return () => globalThis.clearInterval(interval);
  }, [isAuthenticated, isSystemAdmin, queryClient]);

  const latestDataUpdateAt = Math.max(
    kpiMembersUpdatedAt,
    systemTotalsUpdatedAt,
    kpiMembersPrevBaseUpdatedAt,
    newGroups24hUpdatedAt,
    newGroups24hCountUpdatedAt,
    currentPeriodKpisUpdatedAt,
    prevPeriodKpisUpdatedAt,
    pulse24hUpdatedAt,
    0,
  );
  const liveUpdatedAtDate = latestDataUpdateAt > 0 ? new Date(latestDataUpdateAt) : last24hNow;

  const describePercentChange = (delta: number, suffix: string) => {
    if (Math.abs(delta) <= 2) return `Estável em rel. ao ${suffix}`;
    if (delta > 0) return `+${delta}% em rel. ao ${suffix}`;
    return `-${Math.abs(delta)}% em rel. ao ${suffix}`;
  };

  const describeAbsoluteChange = (abs: number, singular: string, plural: string, suffix: string) => {
    if (abs === 0) return `Estável em rel. ao ${suffix}`;
    const unit = Math.abs(abs) === 1 ? singular : plural;
    if (abs > 0) return `+${abs} ${unit} em rel. ao ${suffix}`;
    return `-${Math.abs(abs)} ${unit} em rel. ao ${suffix}`;
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
    return { totalMessages, activeGroups, sharePct };
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

  const newGroupsSummaryLoading = newGroups24hLoading || newGroups24hCountLoading;
  const newGroupsSummaryError = Boolean(newGroups24hError || newGroups24hCountError);
  const pulseSummaryLoading = pulse24hLoading;
  const pulseSummaryError = Boolean(pulse24hError);
  const newGroupsCreated24h = newGroups24hCount ?? newGroups24h?.length ?? 0;
  const retryExecutiveSummary = () => {
    if (newGroupsSummaryError) {
      void queryClient.invalidateQueries({ queryKey: ["system-new-groups-24h"] });
      void queryClient.invalidateQueries({ queryKey: ["system-new-groups-24h-count"] });
    }
    if (pulseSummaryError) {
      void refetchPulse24h();
    }
  };
  const executiveHighlights = [
    {
      label: "Grupos criados",
      value: newGroupsSummaryLoading ? "—" : newGroupsSummaryError ? "Erro" : formatNumberBR(newGroupsCreated24h),
      helper: "novos no período",
    },
    {
      label: "Mensagens",
      value: pulseSummaryLoading ? "—" : pulseSummaryError ? "Erro" : formatNumberBR(pulseMeta.totalMessages),
      helper: "volume em 24h",
    },
    {
      label: "Grupos ativos",
      value: pulseSummaryLoading ? "—" : pulseSummaryError ? "Erro" : formatNumberBR(pulseMeta.activeGroups),
      helper: "com atividade",
    },
  ];
  const topGroupHeadline = pulse24h?.topGroups?.[0] ?? null;
  const dashboardRadarCards = [
    {
      label: "Pulso de 24h",
      value: pulseSummaryLoading ? "—" : pulseSummaryError ? "Erro" : formatNumberBR(pulseMeta.totalMessages),
      detail: "mensagens recentes captadas",
    },
    {
      label: "Organizações em 30d",
      value: kpiOrgsPeriodLoading ? "—" : kpiOrgsPeriodError ? "Erro" : formatNumberBR(kpiOrgsPeriod ?? 0),
      detail: "com atividade recente no período",
    },
    {
      label: "Grupo dominante",
      value: pulseSummaryLoading ? "—" : pulseSummaryError ? "Indisponível" : topGroupHeadline?.name || "Sem destaque",
      detail: pulseSummaryLoading || pulseSummaryError
        ? "sem leitura comparativa"
        : `${formatNumberBR(Number(topGroupHeadline?.count ?? 0))} mensagens no topo do ranking`,
    },
  ];
  const kpiSignalStrip = [
    {
      label: "Mensagens 30d",
      value: kpiMessagesLoading ? "Calculando" : messagesChangeLabel,
      tone: messagesChangeType,
    },
    {
      label: "Membros ativos",
      value: kpiActiveMembersLoading ? "Calculando" : activeMembersChange.label,
      tone: activeMembersChange.type,
    },
    {
      label: "Participação",
      value: kpiActiveMembersLoading || kpiMembersLoading ? "Calculando" : participationChange.label,
      tone: participationChange.type,
    },
  ];

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
        className="bg-card"
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
        className="bg-card"
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
        className="bg-card"
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
        className="bg-card"
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
        className="bg-card"
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
        className="bg-card"
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
      <div className="mx-auto max-w-[1480px] space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando" }]}
          title={(
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">Panorama geral</span>
              <span className="inline-flex h-6 items-center rounded-full border border-primary/20 bg-primary/[0.08] px-2.5 align-middle text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
                Sistema
              </span>
            </div>
          )}
          description="Visão executiva do Bóris com sinais de uso recente, volume e alcance da base."
          className="mb-4"
          filters={(
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Badge variant="outline" className="h-6 border-primary/20 bg-primary/[0.05] px-2.5 text-[11px] font-medium text-primary/85">
                Visão geral do sistema
              </Badge>
              <Badge variant="outline" className="h-6 border-border/60 bg-background/70 px-2.5 text-[11px] font-medium text-muted-foreground">
                Base consolidada
              </Badge>
              <span className="inline-flex h-6 items-center rounded-full border border-border/60 bg-background px-2.5 text-[11px] font-medium text-muted-foreground">
                Atualizado às <span className="ml-1 font-mono text-[0.95em] text-foreground">{formatTimeBR(liveUpdatedAtDate)}</span> BRT
              </span>
            </div>
          )}
        />

        {latestOpenAiBillingAlert && !openAiBillingAlertsLoading ? (
          <section className="rounded-[24px] border border-destructive/25 bg-destructive/[0.05] p-4 shadow-subtle">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full border border-destructive/20 bg-destructive/10 p-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-destructive/25 bg-destructive/10 text-destructive">
                      OpenAI com limite ou cobrança
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Último sinal às <span className="font-mono text-foreground">{formatTimeBR(new Date(latestOpenAiBillingAlert.created_at))}</span> BRT
                    </span>
                    {openAiBillingAlertCount > 1 ? (
                      <span className="text-xs text-muted-foreground">{openAiBillingAlertCount} ocorrências em 24h</span>
                    ) : null}
                  </div>
                  <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    A OpenAI bloqueou uma rotina de IA por quota, limite ou falta de crédito.
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {latestOpenAiBillingMetadata?.operation === "generate-group-topics-keywords"
                      ? "A rotina afetada foi a geração de tópicos e keywords."
                      : "A rotina afetada foi a geração de resumo."}
                    {latestOpenAiBillingMetadata?.group_name ? ` Grupo impactado: ${latestOpenAiBillingMetadata.group_name}.` : ""}
                    {latestOpenAiBillingMetadata?.status ? ` HTTP ${latestOpenAiBillingMetadata.status}.` : ""}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="border-destructive/25 bg-background">
                <Link to="/system/events">Ver eventos do sistema</Link>
              </Button>
            </div>
          </section>
        ) : null}

        <div className="rounded-[24px] border border-border/70 bg-card/90 p-3 shadow-subtle">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Navegação rápida
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Vá direto ao bloco que responde sua dúvida operacional.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="#radar"
                className="inline-flex h-9 items-center rounded-full border border-border/70 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/40"
              >
                Radar
              </a>
              <a
                href="#kpis"
                className="inline-flex h-9 items-center rounded-full border border-border/70 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/40"
              >
                KPIs 30d
              </a>
              <a
                href="#sync-status"
                className="inline-flex h-9 items-center rounded-full border border-border/70 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/40"
              >
                Sync
              </a>
              <a
                href="#executive-summary"
                className="inline-flex h-9 items-center rounded-full border border-primary/20 bg-primary/[0.05] px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/[0.09]"
              >
                Resumo 24h
              </a>
            </div>
          </div>
        </div>

        <section className="rounded-[28px] border border-border/70 bg-card/95 p-4 shadow-subtle sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Como ler esta página
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">
                Faça a leitura em 3 passos para decidir mais rápido
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                O fluxo ideal é identificar o foco do momento, validar se a base está saudável e só então abrir o grupo que merece investigação.
              </p>
            </div>
            <div className="grid gap-3 lg:min-w-[620px] lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">1. Radar</div>
                <p className="mt-2 text-sm font-medium text-foreground">Descubra o recorte que pede atenção agora.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Leia volume, organizações ativas e grupo dominante antes de entrar nos detalhes.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">2. KPIs + Sync</div>
                <p className="mt-2 text-sm font-medium text-foreground">Confirme se o sinal é confiável.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Cruze tendência de 30 dias com cobertura de sync para evitar decisões em cima de dados incompletos.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">3. Resumo 24h</div>
                <p className="mt-2 text-sm font-medium text-foreground">Abra o grupo certo e aja.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Use o ranking final como fila operacional para suporte, operação ou investigação.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="scroll-mt-32 overflow-hidden rounded-[32px] border border-border/80 bg-card/95 shadow-subtle" id="radar">
          <div className="bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--secondary)/0.42),transparent_72%)] px-5 py-6 sm:px-6 lg:px-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" />
                  Radar do sistema
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                    Veja o que acelerou, onde a base está ativa e qual grupo merece investigação primeiro
                  </h3>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                    O painel principal agora combina volume, alcance e concentração operacional para facilitar decisão
                    executiva sem obrigar leitura de todos os blocos.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
                {dashboardRadarCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-border/70 bg-background/85 p-4">
                    <div className="text-[10px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted-foreground">{card.label}</div>
                    <div className="mt-2 truncate text-2xl font-semibold tracking-[-0.03em] text-foreground">{card.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{card.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="scroll-mt-32 overflow-hidden rounded-[32px] border border-border/60 bg-card/95 shadow-subtle" id="kpis">
          <div className="border-b border-border/70 px-5 py-5 sm:px-6 sm:py-6">
          <ExecutiveSectionHeader
            eyebrow="Base e Tendência"
            title="Indicadores principais (30d)"
            description="Volume, alcance e crescimento em leitura executiva."
            icon={Layers}
            badge={(
              <Badge variant="outline" className="h-6 px-2.5 text-[11px] font-medium text-muted-foreground">
                {ADMIN_MICROCOPY.labels.selectedPeriod}
              </Badge>
            )}
          />
          </div>
          <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-3 rounded-[28px] border border-border/60 bg-background/80 p-3 md:grid-cols-3">
            {kpiSignalStrip.map((item) => {
              const toneClassName = item.tone === "positive"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : item.tone === "negative"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-700"
                  : "border-border/70 bg-background text-muted-foreground";

              return (
                <div key={item.label} className="rounded-[var(--radius-md)] border border-border/60 bg-card/90 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted-foreground">
                      {item.label}
                    </p>
                    <Badge variant="outline" className={`h-6 px-2.5 text-[11px] font-semibold ${toneClassName}`}>
                      {item.value}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mainKpis}
          </div>
          {kpiMembersError || kpiMembersPrevBaseError || currentPeriodKpisError || prevPeriodKpisError || systemTotalsError ? (
            <p className="text-sm text-muted-foreground">
              Alguns indicadores podem estar incompletos no momento. Tente atualizar a página em instantes.
            </p>
          ) : null}
          </div>
        </section>

        <section className="scroll-mt-32" id="sync-status">
          <ConnectionStatus />
        </section>

        <section className="scroll-mt-32 overflow-hidden rounded-[32px] border border-primary/10 bg-card/95 shadow-subtle" id="executive-summary" aria-busy={newGroups24hLoading || newGroups24hCountLoading || pulse24hLoading ? "true" : undefined}>
          <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.1),transparent_34%),linear-gradient(180deg,hsl(var(--secondary)/0.25),transparent)] px-5 py-5 sm:px-6 sm:py-6">
          <ExecutiveSectionHeader
            eyebrow="Operação"
            eyebrowTone="primary"
            title="Resumo das últimas 24h"
            description="Leitura rápida do movimento recente com um ranking claro de onde investigar primeiro."
            icon={Activity}
            badge={(
              <Badge variant="outline" className="h-6 border-primary/20 bg-primary/[0.04] px-2.5 text-[11px] font-medium text-primary/85">
                Atualização contínua
              </Badge>
            )}
          />
          </div>
          <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {executiveHighlights.map((item) => (
                <div key={item.label} className="rounded-[24px] border border-border/70 bg-background/80 px-4 py-4 shadow-subtle">
                  <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.04em] text-foreground">
                    {item.value}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.helper}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[28px] border border-border/60 bg-card/95 p-4 shadow-subtle lg:flex lg:max-h-[760px] lg:flex-col">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted-foreground">Grupos mais movimentados</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ranking para abrir e agir nas conversas com mais volume agora.</p>
                </div>
                <Badge variant="outline" className="h-5 border-border/60 bg-background/60 px-2 text-[11px] text-muted-foreground">
                  {pulseSummaryLoading ? "—" : pulseSummaryError ? "indisponível" : `${pulseMeta.sharePct}%`} top 4 grupos
                </Badge>
              </div>

              {pulseSummaryLoading ? (
                <div className="mt-3 space-y-2" aria-live="polite" aria-busy="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card/50 p-2.5">
                      <Skeleton className="h-3 w-8/12" />
                      <Skeleton className="mt-2 h-3 w-6/12" />
                    </div>
                  ))}
                </div>
              ) : pulseSummaryError ? (
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
                  {topGroupHeadline ? (
                    <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.06em] text-primary/80">Prioridade agora</p>
                      <p className="mt-1 text-sm font-semibold text-card-foreground">{topGroupHeadline.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Lidera o ranking com {formatNumberBR(Number(topGroupHeadline.count || 0))} mensagens nas últimas 24h.
                      </p>
                    </div>
                  ) : null}
                  <ScrollArea className="mt-3 min-h-0 lg:flex-1">
                    <div className="space-y-3 pr-3">
                      {pulse24h.topGroups.slice(0, TOP_GROUPS_24H_LIMIT).map((g, idx) => {
                        const count = Number(g.count || 0);
                        const share = pulseMeta.totalMessages ? Math.round((count / pulseMeta.totalMessages) * 100) : 0;
                        return (
                          <Link
                            key={g.id}
                            to={`/groups/${g.id}`}
                            onClick={() => trackDashboardInteraction("pulse_top_group_click", { groupId: g.id, rank: idx + 1 })}
                            className="ripple-surface group block rounded-[20px] border border-border/70 bg-background/80 px-3 py-3 transition-colors hover:bg-secondary/20"
                          >
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-[11px] font-semibold text-muted-foreground">
                                    {idx + 1}
                                  </span>
                                  <p className="truncate text-sm font-semibold text-card-foreground">{g.name}</p>
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>{formatNumberBR(count)} mensagens</span>
                                  <span>{share}% do volume captado</span>
                                </div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
                                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(Math.max(share, 6), 100)}%` }} />
                                </div>
                                <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                                  <span>Investigar grupo</span>
                                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </div>
                              </div>
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
