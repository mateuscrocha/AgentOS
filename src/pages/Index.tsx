import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
 
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { Activity, AlertTriangle, Building2, Clock, Layers, Users as UsersIcon, MessageSquare, ChevronRight, ArrowUp, Info, Minus } from "lucide-react";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { SectionHeader } from "@/components/group-dashboard/SectionHeader";
import {
  PeriodType,
  DateRange,
  getDateRange,
  parseStoredPeriod,
  buildStoredPeriod,
} from "@/components/group-dashboard/period-utils";
 
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getPostLoginRedirectPath } from "@/lib/auth-routing";

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

const Index = () => {
  const navigate = useNavigate();
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

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('30d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const currentRange = useMemo(
    () => getDateRange(selectedPeriod, customRange),
    [selectedPeriod, customRange],
  );
  const handlePeriodChange = (period: PeriodType, range: DateRange) => {
    setSelectedPeriod(period);
    setCustomRange(period === 'custom' ? range : undefined);
  };
  const hasActiveFilters = selectedPeriod !== '30d' || !!customRange;
  const handleClearFilters = () => {
    setSelectedPeriod('30d');
    setCustomRange(undefined);
  };

  const formatNumberBR = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
  const formatTimeBR = (date: Date) => formatInTimeZone(date, SAO_PAULO_TZ, "HH:mm");

  const [showBackToTop, setShowBackToTop] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      window.history.replaceState(null, "", `#${id}`);
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem('system-admin-period');
      if (raw) {
        const saved = JSON.parse(raw);
        const { period, range, isValid } = parseStoredPeriod(saved, "30d");
        if (!isValid) {
          localStorage.removeItem('system-admin-period');
        }
        setSelectedPeriod(period);
        setCustomRange(range);
      }
    } catch { void 0; }
  }, []);

  useEffect(() => {
    const payload = buildStoredPeriod(selectedPeriod, customRange);
    try {
      localStorage.setItem('system-admin-period', JSON.stringify(payload));
    } catch { void 0; }
  }, [selectedPeriod, customRange]);

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
      .limit(10);
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
    data: newGroups24h,
    isLoading: newGroups24hLoading,
    error: newGroups24hError,
    refetch: refetchNewGroups24h,
  } = useQuery({
    queryKey: ["system-new-groups-24h", last24hStartISO, last24hEndISO, 10],
    queryFn: fetchNewGroups24h,
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

  useEffect(() => {
    if (kpiMembersError || currentPeriodKpisError || prevPeriodKpisError) {
      notify.error("Alguns indicadores não puderam ser carregados", "Você ainda pode usar os blocos com dados disponíveis.");
    }
  }, [
    kpiMembersError,
    currentPeriodKpisError,
    prevPeriodKpisError,
  ]);


  const {
    data: pulse24h,
    isLoading: pulse24hLoading,
    error: pulse24hError,
    refetch: refetchPulse24h,
  } = useQuery({
    queryKey: ["signal-concentration-24h", last24hStartISO, last24hEndISO, 10],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_system_signal_concentration", {
        p_start: last24hStartISO,
        p_end: last24hEndISO,
        p_limit: 10,
      });
      if (error) throw error;
      return data as unknown as SignalConcentrationPayload;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Central do Bóris" subtitle="Carregando...">
        <PageSkeleton />
      </AdminLayout>
    );
  }

  if (!isAuthenticated || !isSystemAdmin) {
    return null;
  }

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
    const total = kpiMembers || 0;
    const currActive = kpiActiveMembersPeriod || 0;
    const prevActive = kpiActiveMembersPrevPeriod ?? null;
    if (!total || prevActive === null) return { label: "—", type: "neutral" as const };
    const currPct = total ? (currActive / total) * 100 : 0;
    const prevPct = total ? (prevActive / total) * 100 : 0;
    const delta = currPct - prevPct;
    const rounded = Math.round(delta * 10) / 10;
    if (rounded === 0) return { label: "Estável", type: "neutral" as const };
    if (Math.abs(rounded) <= 2) return { label: "Estável", type: "neutral" as const };
    const formatted = `${String(Math.abs(rounded)).replace(".", ",")}`;
    const type = rounded > 0 ? "positive" as const : "negative" as const;
    return { label: rounded > 0 ? `Subiu ${formatted} p.p. em relação ao período anterior` : `Caiu ${formatted} p.p. em relação ao período anterior`, type };
  })();

  const periodLabel = `${formatDateSimpleBR(currentRange.from)} — ${formatDateSimpleBR(currentRange.to)}`;

  const formatHoursAgoLabel = (hours: number) => {
    if (!Number.isFinite(hours) || hours <= 0) return "agora";
    if (hours === 1) return "há 1h";
    return `há ${hours}h`;
  };

  const toneBadgeClassName = (tone: "warning" | "muted" | "info") => {
    if (tone === "warning") return "border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]";
    if (tone === "info") return "border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))]";
    return "border-border/70 bg-secondary/50 text-muted-foreground";
  };

  const toneCardClassName = (tone: "warning" | "muted" | "info") => {
    if (tone === "warning") return "border-[hsl(var(--warning)/0.26)] bg-[hsl(var(--warning)/0.06)] hover:bg-[hsl(var(--warning)/0.08)]";
    if (tone === "info") return "border-[hsl(var(--info)/0.24)] bg-[hsl(var(--info)/0.05)] hover:bg-[hsl(var(--info)/0.07)]";
    return "border-border/60 bg-card/55 hover:bg-secondary/20";
  };

  const pulseMeta = (() => {
    const totalMessages = Number(pulse24h?.totalMessages || 0);
    const activeGroups = Number(pulse24h?.activeGroups || 0);
    const top = pulse24h?.topGroups || [];
    const top4Messages = top.slice(0, 4).reduce((acc, g) => acc + Number(g.count || 0), 0);
    const top4Share = totalMessages ? top4Messages / totalMessages : 0;
    const sharePct = Math.round(top4Share * 100);
    const concentration = sharePct >= 65 ? "alta" : sharePct >= 45 ? "média" : "baixa";
    const concentrationTone: "warning" | "info" | "muted" = sharePct >= 65 ? "warning" : sharePct >= 45 ? "info" : "muted";
    const insight = (() => {
      if (totalMessages === 0 || activeGroups === 0) return "Sem atividade relevante nas últimas 24h.";
      if (sharePct >= 65) return "A conversa está concentrada em poucos grupos.";
      if (sharePct >= 45) return "A conversa está moderadamente concentrada.";
      return "Atividade bem distribuída entre os grupos.";
    })();
    return { totalMessages, activeGroups, sharePct, concentration, concentrationTone, insight };
  })();

  const pulseRankCardClassName = (rank: 1 | 2 | 3 | 4) => {
    if (rank === 1) return "border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning)/0.08)] hover:bg-[hsl(var(--warning)/0.10)]";
    if (rank === 2) return "border-[hsl(var(--info)/0.26)] bg-[hsl(var(--info)/0.07)] hover:bg-[hsl(var(--info)/0.09)]";
    if (rank === 3) return "border-border/70 bg-card/60 hover:bg-secondary/25";
    return "border-border/60 bg-card/55 hover:bg-secondary/20";
  };

  const pulseRankBadgeClassName = (rank: 1 | 2 | 3 | 4) => {
    if (rank === 1) return "border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]";
    if (rank === 2) return "border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info)/0.10)] text-[hsl(var(--info))]";
    if (rank === 3) return "border-border/70 bg-secondary/30 text-muted-foreground";
    return "border-border/60 bg-secondary/20 text-muted-foreground/80";
  };

  const alerts24h = (() => {
    const alerts: Array<{
      id: string;
      tone: "warning" | "info" | "muted";
      title: string;
      description: string;
      href: string;
    }> = [];

    if (!newGroups24hLoading && !newGroups24hError) {
      const idle = (newGroups24h || []).filter((g) => g.status === "idle").slice(0, 3);
      idle.forEach((g) => {
        alerts.push({
          id: `idle-${g.id}`,
          tone: "info",
          title: "Grupo novo sem atividade",
          description: `${g.name} entrou ${formatHoursAgoLabel(g.createdHoursAgo)} e ainda não teve mensagens.`,
          href: `/groups/${g.id}`,
        });
      });
    }

    if (!pulse24hLoading && !pulse24hError) {
      if (pulseMeta.totalMessages === 0) {
        alerts.push({
          id: "no-activity",
          tone: "muted",
          title: "Baixa atividade",
          description: "Nenhuma mensagem registrada nas últimas 24h.",
          href: "/system/groups",
        });
      } else if (pulseMeta.sharePct >= 65) {
        alerts.push({
          id: "high-concentration",
          tone: "warning",
          title: "Concentração alta",
          description: `Top 4 grupos concentram ${pulseMeta.sharePct}% das mensagens nas últimas 24h.`,
          href: "/system/groups",
        });
      }
    }

    return alerts.slice(0, 4);
  })();

  const daySummary = (() => {
    if (newGroups24hLoading || pulse24hLoading) {
      return "Carregando leitura das últimas 24h…";
    }
    const newGroupsCount = newGroups24h?.length || 0;
    const totalMessages = pulseMeta.totalMessages;
    const activeGroups = pulseMeta.activeGroups;
    const concentration = pulseMeta.concentration;
    return `Nas últimas 24h, foram criados ${newGroupsCount} grupos. Houve ${formatNumberBR(totalMessages)} mensagens em ${formatNumberBR(activeGroups)} grupos, com atividade ${concentration === "alta" ? "concentrada em poucos grupos" : concentration === "média" ? "moderadamente concentrada" : "bem distribuída"}.`;
  })();

  const mainKpis = (
    <>
      <StatsCard
        title="Mensagens no período"
        value={kpiMessagesError ? "Erro" : String(kpiMessagesPeriod ?? 0)}
        isLoading={kpiMessagesLoading}
        change={kpiMessagesLoading ? undefined : messagesChangeLabel}
        changeType={messagesChangeType}
        icon={MessageSquare}
        description="Total de mensagens enviadas no período escolhido"
        variant="kpi"
      />
      <StatsCard
        title="Membros ativos"
        value={kpiActiveMembersError ? "Erro" : String(kpiActiveMembersPeriod ?? 0)}
        isLoading={kpiActiveMembersLoading}
        change={kpiActiveMembersLoading ? undefined : activeMembersChange.label}
        changeType={activeMembersChange.type}
        icon={UsersIcon}
        description="Pessoas que enviaram pelo menos 1 mensagem"
        variant="kpi"
      />
      <StatsCard
        title="Participação dos membros"
        value={participationValue}
        isLoading={kpiActiveMembersLoading || kpiMembersLoading}
        change={participationChange.label}
        changeType={participationChange.type}
        icon={UsersIcon}
        description="Percentual de membros que participaram com mensagem"
        variant="kpi"
      />
    </>
  );

  const contextKpis = (
    <>
      <StatsCard
        title="Organizações ativas"
        value={kpiOrgsPeriodError ? "Erro" : String(kpiOrgsPeriod ?? 0)}
        isLoading={kpiOrgsPeriodLoading}
        change={kpiOrgsPeriodLoading ? undefined : orgsChange.label}
        changeType={orgsChange.type}
        icon={Building2}
        description="Organizações com pelo menos um grupo ativo"
        variant="kpi"
      />
      <StatsCard
        title="Grupos monitorados"
        value={kpiGroupsPeriodError ? "Erro" : String(kpiGroupsPeriod ?? 0)}
        isLoading={kpiGroupsPeriodLoading}
        change={kpiGroupsPeriodLoading ? undefined : groupsChange.label}
        changeType={groupsChange.type}
        icon={Layers}
        description="Grupos que tiveram mensagens no período"
        variant="kpi"
      />
    </>
  );

  return (
    <AdminLayout 
      title="Central do Bóris" 
      subtitle="Panorama geral do Bóris"
    >
      <div className="space-y-10 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central do Bóris" }]}
          title="Central do Bóris"
          description="Panorama geral do Bóris"
          filters={(
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium text-foreground">Período</span>
              <PeriodFilter value={selectedPeriod} customRange={customRange} onChange={handlePeriodChange} />
              <span className="text-sm text-muted-foreground">Atualizado às {formatTimeBR(last24hNow)} (BRT)</span>
              <span className="w-full text-xs text-muted-foreground/90 sm:w-auto">Período selecionado: {periodLabel}</span>
            </div>
          )}
          showClearFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />

        <section className="scroll-mt-32 rounded-2xl border border-border bg-card p-4 shadow-sm" id="executive-summary" aria-busy={newGroups24hLoading || pulse24hLoading ? "true" : undefined}>
          <SectionHeader
            title="Resumo do dia"
            subtitle="Entenda rapidamente o que aconteceu e onde agir"
            subtitleClassName="font-normal text-muted-foreground/80"
            density="compact"
            titleIcon={Activity}
          />

          <div className="mt-2 space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
              <p className="text-sm leading-relaxed text-card-foreground">
                <span className="font-medium">Resumo em 1 minuto:</span> {daySummary}
              </p>
            </div>

            {!newGroups24hLoading && !pulse24hLoading && alerts24h.length > 0 ? (
              <div className="rounded-xl border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.07)] p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--warning)/0.14)]">
                    <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-card-foreground">O que fazer agora</p>
                    <p className="mt-1 text-sm text-card-foreground/90">
                      Você tem {alerts24h.length} ponto(s) para revisar. Comece pelos alertas abaixo.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => scrollToSection("executive-summary")}>
                    Ver alertas
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => scrollToSection("context")}>
                    Ver base analisada
                  </Button>
                </div>
              </div>
            ) : !newGroups24hLoading && !pulse24hLoading ? (
              <div className="rounded-xl border border-success/25 bg-success/5 p-4">
                <p className="text-sm font-semibold text-card-foreground">Tudo sob controle</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Não há alertas imediatos nas últimas 24h. Você pode revisar os indicadores e a base analisada abaixo.
                </p>
              </div>
            ) : null}

            <div className="rounded-xl border border-border/60 bg-muted/20 px-3">
              <Accordion type="multiple" defaultValue={["alerts"]} className="w-full">
                <AccordionItem value="alerts" className="border-border/60">
                  <AccordionTrigger className="text-sm text-muted-foreground hover:text-foreground">
                    <div className="flex items-center gap-2 min-w-0">
                      <span>Alertas importantes (24h)</span>
                      <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium tabular-nums">
                        {alerts24h.length}
                      </Badge>
                      <span className="text-xs text-muted-foreground/80">Abrir</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {newGroups24hLoading && pulse24hLoading ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="rounded-lg border border-border bg-card/50 p-2.5">
                            <Skeleton className="h-4 w-7/12" />
                            <div className="mt-2 space-y-2">
                              <Skeleton className="h-3 w-full" />
                              <Skeleton className="h-3 w-9/12" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : alerts24h.length === 0 && (newGroups24hLoading || pulse24hLoading) ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-live="polite" aria-busy="true">
                        {Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="rounded-lg border border-border bg-card/50 p-2.5">
                            <Skeleton className="h-4 w-6/12" />
                            <div className="mt-2 space-y-2">
                              <Skeleton className="h-3 w-full" />
                              <Skeleton className="h-3 w-10/12" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : alerts24h.length === 0 ? (
                      <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                        <p className="text-sm font-medium text-card-foreground">Nenhum alerta importante nas últimas 24h</p>
                        <p className="mt-1 text-sm text-muted-foreground">Sinal de estabilidade. Se quiser, veja os grupos com mais movimento logo abaixo.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-live="polite">
                        {alerts24h.map((a, i) => {
                          const ToneIcon = a.tone === "warning" ? AlertTriangle : a.tone === "info" ? Info : Minus;
                          const alertCtaLabel = a.href.startsWith("/groups/") ? "Abrir grupo para verificar" : "Ver lista de grupos";
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => navigate(a.href)}
                              className={
                                "ripple-surface group w-full text-left rounded-lg border px-3 py-3 shadow-sm transition-colors transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background animate-fade-in " +
                                toneCardClassName(a.tone)
                              }
                              style={{ animationDelay: `${i * 60}ms` }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={"h-5 px-2 text-[10px] font-medium " + toneBadgeClassName(a.tone)}>
                                      <span className="inline-flex items-center gap-1">
                                        <ToneIcon className="h-3 w-3" aria-hidden="true" />
                                        {a.tone === "warning" ? "Atenção" : a.tone === "info" ? "Acompanhar" : "Info"}
                                      </span>
                                    </Badge>
                                    <div className="text-[13px] font-semibold leading-snug text-foreground truncate">{a.title}</div>
                                  </div>
                                  <p className="mt-1 text-[13px] text-muted-foreground leading-snug">{a.description}</p>
                                  <p className="mt-2 text-xs font-medium text-foreground/80">{alertCtaLabel}</p>
                                </div>
                                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" aria-hidden="true" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="pulse" className="border-border/60">
                  <AccordionTrigger className="text-sm text-muted-foreground hover:text-foreground">
                    <div className="flex items-center gap-2">
                      <span>Grupos com mais movimento (24h)</span>
                      <Badge variant="outline" className="h-5 border-border/60 bg-transparent px-2 text-[10px] font-medium text-muted-foreground">
                        Conversa {pulseMeta.concentration === "alta" ? "concentrada" : pulseMeta.concentration === "média" ? "moderada" : "distribuída"}
                      </Badge>
                      <span className="text-xs text-muted-foreground/80">Abrir</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {pulse24hLoading ? (
                      <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <div className="rounded-lg border border-border bg-card/50 p-2.5">
                          <Skeleton className="h-4 w-6/12" />
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <div key={i} className="rounded-lg border border-border bg-card/50 p-2.5">
                                <Skeleton className="h-4 w-10/12" />
                                <div className="mt-2 space-y-2">
                                  <Skeleton className="h-3 w-8/12" />
                                  <Skeleton className="h-3 w-7/12" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-lg border border-border bg-card/50 p-2.5">
                              <Skeleton className="h-4 w-8/12" />
                              <Skeleton className="mt-2 h-3 w-5/12" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : pulse24hError ? (
                      <div>
                        <ErrorState title="Falha ao carregar" message="Não foi possível carregar o pulso das comunidades (24h)." retry={refetchPulse24h} />
                      </div>
                    ) : !pulse24h || !pulse24h.topGroups || pulse24h.topGroups.length === 0 ? (
                      <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                        <p className="text-sm font-medium text-card-foreground">Ainda sem movimento suficiente para análise</p>
                        <p className="mt-1 text-sm text-muted-foreground">Quando houver mensagens em mais grupos, este bloco mostra onde a conversa está concentrada.</p>
                      </div>
                    ) : (
                      <div className="space-y-3" aria-live="polite">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold leading-tight text-card-foreground">
                              <span className="tabular-nums">{formatNumberBR(pulseMeta.totalMessages)}</span> mensagens
                              <span className="mx-2 text-muted-foreground/50">·</span>
                              <span className="tabular-nums">{formatNumberBR(pulseMeta.activeGroups)}</span> grupos ativos
                            </div>
                            <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                              Top 4 concentram <span className="font-medium tabular-nums text-card-foreground">{pulseMeta.sharePct}%</span> da conversa
                            </div>
                            <div className="mt-1 text-[13px] leading-snug text-muted-foreground/80">{pulseMeta.insight}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {pulse24h.topGroups.slice(0, 4).map((g, idx) => {
                            const count = Number(g.count || 0);
                            const share = pulseMeta.totalMessages ? Math.round((count / pulseMeta.totalMessages) * 100) : 0;
                            const rank = (idx + 1) as 1 | 2 | 3 | 4;
                            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "4";
                            const activeMembers = Number(g.activeMembers || 0);
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => navigate(`/groups/${g.id}`)}
                                className={
                                  "ripple-surface group w-full text-left rounded-lg border px-3 py-3 shadow-sm transition-colors transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background animate-fade-in " +
                                  pulseRankCardClassName(rank)
                                }
                                style={{ animationDelay: `${idx * 60}ms` }}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={
                                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-base font-semibold tabular-nums " +
                                      pulseRankBadgeClassName(rank)
                                    }
                                    aria-hidden="true"
                                  >
                                    {medal}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="text-[14px] font-semibold leading-snug text-card-foreground truncate">{g.name}</div>
                                    <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                                      <span className="tabular-nums font-medium text-card-foreground/90">{formatNumberBR(count)}</span> mensagens
                                      <span className="mx-2 text-muted-foreground/50">·</span>
                                      <span className="tabular-nums">{formatNumberBR(activeMembers)}</span> ativos
                                    </div>
                                    <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground/90">
                                      <span className="tabular-nums">{share}%</span> da conversa total
                                    </div>
                                    <div className="mt-2 text-xs font-medium text-foreground/80">Abrir grupo</div>
                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                                      <div
                                        className={cn(
                                          "h-full rounded-full",
                                          rank === 1 ? "bg-[hsl(var(--warning))]/70" : rank === 2 ? "bg-[hsl(var(--info))]/70" : "bg-primary/60",
                                        )}
                                        style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
                                        aria-hidden="true"
                                      />
                                    </div>
                                  </div>

                                  <ChevronRight
                                    className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {pulse24h.topGroups.length > 4 && (
                          <div className="rounded-lg border border-border bg-card/30 p-2.5">
                            <div className="text-xs text-muted-foreground/80">Outros grupos com movimento (5º ao 10º)</div>
                            <ul className="mt-2 space-y-1" role="list">
                              {pulse24h.topGroups.slice(4, 10).map((g, idx) => {
                                const rank = idx + 5;
                                const count = Number(g.count || 0);
                                const share = pulseMeta.totalMessages ? Math.round((count / pulseMeta.totalMessages) * 100) : 0;
                                return (
                                  <li key={g.id} role="listitem">
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/groups/${g.id}`)}
                                      className="ripple-surface group w-full text-left rounded-md border border-border/70 bg-card/40 px-2.5 py-1.5 transition-colors transition-transform hover:bg-secondary/25 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex items-center gap-2">
                                          <div className="w-6 text-[10px] font-medium tabular-nums text-muted-foreground/60" aria-hidden="true">
                                            {rank}
                                          </div>
                                          <div className="min-w-0 text-[13px] font-medium leading-snug text-card-foreground truncate">{g.name}</div>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2">
                                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border/40" aria-hidden="true">
                                            <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
                                          </div>
                                          <div className="text-[12px] font-semibold tabular-nums text-card-foreground">{formatNumberBR(count)}</div>
                                          <div className="text-[10px] text-muted-foreground/70">msg</div>
                                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" aria-hidden="true" />
                                        </div>
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="new-groups" className="border-border/60">
                  <AccordionTrigger className="text-sm text-muted-foreground hover:text-foreground">
                    <div className="flex items-center gap-2">
                      <span>Grupos criados nas últimas 24h</span>
                      <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium tabular-nums">
                        {newGroups24h?.length ?? 0}
                      </Badge>
                      <span className="text-xs text-muted-foreground/80">Abrir</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {newGroups24hLoading ? (
                      <div className="grid grid-cols-1 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="rounded-lg border border-border bg-card/50 p-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-4 w-7/12" />
                                <div className="flex flex-wrap gap-2">
                                  <Skeleton className="h-3 w-16" />
                                  <Skeleton className="h-3 w-20" />
                                  <Skeleton className="h-3 w-16" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Skeleton className="h-6 w-16" />
                                <Skeleton className="h-3 w-10" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : newGroups24hError ? (
                      <div>
                        <ErrorState title="Falha ao carregar" message="Não foi possível carregar os novos grupos das últimas 24h." retry={refetchNewGroups24h} />
                      </div>
                    ) : !newGroups24h || newGroups24h.length === 0 ? (
                      <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                        <p className="text-sm font-medium text-card-foreground">Nenhum grupo novo nas últimas 24h</p>
                        <p className="mt-1 text-sm text-muted-foreground">Se quiser acompanhar criação de grupos, mude o período no topo para uma janela maior.</p>
                      </div>
                    ) : (
                      <div className="space-y-2" aria-live="polite">
                        <div className="text-xs text-muted-foreground/80">
                          Dica: grupos com mensagens já começaram a conversar; grupos sem atividade podem precisar de uma primeira ação.
                        </div>

                        <ul className="space-y-2" role="list">
                          {newGroups24h.map((g, idx) => {
                            const statusTone: "warning" | "info" | "muted" = g.status === "active" ? "warning" : g.status === "new" ? "info" : "muted";
                            const statusLabel = g.status === "active" ? "Ativo" : g.status === "new" ? "Novo" : "Sem atividade";
                            const StatusIcon = g.status === "active" ? Activity : g.status === "new" ? Clock : Minus;
                            const firstActivityLabel = (() => {
                              if (!g.firstActivityAt) return "—";
                              const date = new Date(g.firstActivityAt);
                              if (!Number.isFinite(date.getTime())) return "—";
                              return formatInTimeZone(date, SAO_PAULO_TZ, "HH:mm");
                            })();

                            return (
                              <li key={g.id} role="listitem">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/groups/${g.id}`)}
                                  className="ripple-surface group w-full text-left rounded-lg border border-border bg-card/50 px-2.5 py-2 transition-colors transition-transform duration-200 hover:bg-secondary/30 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background animate-fade-in"
                                  style={{ animationDelay: `${idx * 30}ms` }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Badge variant="outline" className={"h-5 px-2 text-[10px] font-medium shrink-0 " + toneBadgeClassName(statusTone)}>
                                          <span className="inline-flex items-center gap-1">
                                            <StatusIcon className="h-3 w-3" aria-hidden="true" />
                                            {statusLabel}
                                          </span>
                                        </Badge>
                                        <div className="text-[13px] font-semibold leading-snug text-foreground truncate">{g.name}</div>
                                      </div>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                        <span className="truncate max-w-[26ch]">{g.organizations?.name || "—"}</span>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span className="whitespace-nowrap tabular-nums">{formatHoursAgoLabel(g.createdHoursAgo)}</span>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span className="whitespace-nowrap tabular-nums">{formatNumberBR(g.messages24h)} msg</span>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span className="whitespace-nowrap tabular-nums">1ª às {firstActivityLabel}</span>
                                      </div>
                                      <div className="mt-2 text-xs font-medium text-foreground/80">Abrir grupo</div>
                                    </div>

                                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" aria-hidden="true" />
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>

        <section className="scroll-mt-32 rounded-2xl bg-card p-4 shadow-sm" id="kpis">
          <SectionHeader
            title="Indicadores principais"
            subtitle="Números mais importantes no período escolhido"
            subtitleClassName="font-normal text-muted-foreground/75"
            density="compact"
            titleIcon={Layers}
          />
          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-3">
            {mainKpis}
          </div>
          <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-sm text-muted-foreground/95">
              Dica rápida: estes números mostram volume de mensagens e participação. Se algo cair muito, veja os alertas na seção acima.
            </p>
          </div>
          {kpiMembersError || currentPeriodKpisError || prevPeriodKpisError ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Alguns indicadores podem estar incompletos no momento. Tente atualizar a página em instantes.
            </p>
          ) : null}
        </section>

        <section className="scroll-mt-32 rounded-2xl bg-card p-4 shadow-sm" id="context">
          <SectionHeader
            title="Base analisada no período"
            subtitle="Escopo usado para calcular os indicadores"
            subtitleClassName="font-normal text-muted-foreground/75"
            density="compact"
            titleIcon={Layers}
          />
          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2">
            {contextKpis}
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
