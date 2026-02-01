import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
      if (groups && groups.length > 0) {
        navigate(`/groups/${groups[0]}`, { replace: true });
      } else if (orgs && orgs.length > 0) {
        navigate(`/organization/${orgs[0]}`, { replace: true });
      } else {
        navigate("/no-access", { replace: true });
      }
    }
  }, [authLoading, rolesLoading, isAuthenticated, isSystemAdmin, getAccessibleGroupIds, getAccessibleOrgIds, navigate]);

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('30d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const currentRange = getDateRange(selectedPeriod, customRange);
  const queryClient = useQueryClient();
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

  const pageSections = useMemo(
    () => [
      { id: "kpis", label: "KPIs" },
      { id: "executive-summary", label: "Resumo" },
      { id: "context", label: "Contexto" },
    ],
    [],
  );

  const [activeSectionId, setActiveSectionId] = useState(pageSections[0]?.id ?? "kpis");
  const [scrollProgress, setScrollProgress] = useState(0);
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
        const max = Math.max(doc.scrollHeight - doc.clientHeight, 1);
        const pct = Math.max(0, Math.min(100, (scrollTop / max) * 100));
        setScrollProgress(pct);
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
    const ids = pageSections.map((s) => s.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const candidates = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));
        const top = candidates[0];
        const id = (top?.target as HTMLElement | undefined)?.id;
        if (id) setActiveSectionId(id);
      },
      {
        threshold: [0.25, 0.4, 0.6],
        rootMargin: "-20% 0px -70% 0px",
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pageSections]);

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

  useEffect(() => {
    try {
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0] as string | undefined;
          return typeof k === 'string' && (k.startsWith('kpi-') || k.startsWith('system-') || k.startsWith('signal-'));
        }
      });
    } catch { void 0; }
  }, [selectedPeriod, customRange, queryClient]);

  const computeComparisonRange = () => {
    const now = new Date();
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
  };

  const { prevFrom, prevTo } = computeComparisonRange();
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

  const getComparisonSuffix = () => {
    switch (selectedPeriod) {
      default:
        return 'vs período anterior';
    }
  };
  const comparisonSuffix = getComparisonSuffix();

  const fetchTotalMembersCount = async () => {
    const { count, error } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);
    if (error) throw error;
    return count ?? 0;
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
    data: kpiOrgsPeriod,
    isLoading: kpiOrgsPeriodLoading,
    error: kpiOrgsPeriodError,
  } = useQuery({
    queryKey: ["kpi-organizations-active-period", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { data: msgData, error: msgErr } = await supabase
        .from("messages")
        .select("group_id,created_at")
        .is("deleted_at", null)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString());
      if (msgErr) throw msgErr;
      const groupIds = Array.from(new Set((msgData || []).map((m: any) => m.group_id).filter(Boolean)));
      if (groupIds.length === 0) return 0;
      const { data: groupsData, error: grpErr } = await supabase
        .from("groups")
        .select("id,organization_id")
        .in("id", groupIds);
      if (grpErr) throw grpErr;
      const orgIds = Array.from(new Set((groupsData || []).map((g: any) => g.organization_id).filter(Boolean)));
      return orgIds.length;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const { data: kpiGroupsPeriod, 
    isLoading: kpiGroupsPeriodLoading,
    error: kpiGroupsPeriodError,
  } = useQuery({
    queryKey: ["kpi-groups-active-period", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("group_id")
        .is("deleted_at", null)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString());
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((m: any) => m.group_id).filter(Boolean)));
      return ids.length;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const { data: kpiGroupsPrevPeriod } = useQuery({
    queryKey: ["kpi-groups-active-prev-period", prevStartISO, prevEndISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("group_id")
        .is("deleted_at", null)
        .gte("created_at", prevStartISO)
        .lte("created_at", prevEndISO);
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((m: any) => m.group_id).filter(Boolean)));
      return ids.length;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

 

  const {
    data: kpiMessagesPeriod,
    isLoading: kpiMessagesLoading,
    error: kpiMessagesError,
  } = useQuery({
    queryKey: ["kpi-messages-period", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const { data: kpiMessagesPrevPeriod } = useQuery({
    queryKey: ["kpi-messages-prev-period", prevStartISO, prevEndISO],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", prevStartISO)
        .lte("created_at", prevEndISO);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const { data: kpiOrgsPrevPeriod } = useQuery({
    queryKey: ["kpi-organizations-active-prev-period", prevStartISO, prevEndISO],
    queryFn: async () => {
      const { data: msgData, error: msgErr } = await supabase
        .from("messages")
        .select("group_id,created_at")
        .is("deleted_at", null)
        .gte("created_at", prevStartISO)
        .lte("created_at", prevEndISO);
      if (msgErr) throw msgErr;
      const groupIds = Array.from(new Set((msgData || []).map((m: any) => m.group_id).filter(Boolean)));
      if (groupIds.length === 0) return 0;
      const { data: groupsData, error: grpErr } = await supabase
        .from("groups")
        .select("id,organization_id")
        .in("id", groupIds);
      if (grpErr) throw grpErr;
      const orgIds = Array.from(new Set((groupsData || []).map((g: any) => g.organization_id).filter(Boolean)));
      return orgIds.length;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: kpiActiveMembersPeriod,
    isLoading: kpiActiveMembersLoading,
    error: kpiActiveMembersError,
  } = useQuery({
    queryKey: ["kpi-active-members-period", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("member_id")
        .is("deleted_at", null)
        .not("member_id", "is", null)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString());
      if (error) throw error;
      const set = new Set((data || []).map((row: any) => row.member_id).filter(Boolean));
      return set.size;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const { data: kpiActiveMembersPrevPeriod } = useQuery({
    queryKey: ["kpi-active-members-prev-period", prevStartISO, prevEndISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("member_id")
        .is("deleted_at", null)
        .not("member_id", "is", null)
        .gte("created_at", prevStartISO)
        .lte("created_at", prevEndISO);
      if (error) throw error;
      const set = new Set((data || []).map((row: any) => row.member_id).filter(Boolean));
      return set.size;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  useEffect(() => {
    if (kpiMembersError) notify.error("Falha ao carregar Membros", "Tente novamente.");
    if (kpiMessagesError) notify.error("Falha ao carregar Mensagens do período", "Tente novamente.");
    if (kpiActiveMembersError) notify.error("Falha ao carregar Membros ativos", "Tente novamente.");
  }, [
    kpiMembersError,
    kpiMessagesError,
    kpiActiveMembersError,
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

  

  useEffect(() => {
    if (pulse24hError) notify.error("Falha ao carregar pulso (24h)", "Tente novamente.");
    if (newGroups24hError) notify.error("Falha ao carregar novos grupos (24h)", "Tente novamente.");
  }, [pulse24hError, newGroups24hError]);

 

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
    if (curr === prev) return "sem variação";
    if (prev === 0) return curr > 0 ? `novo ${comparisonSuffix}` : "sem variação";
    const d = messagesDelta as number;
    if (Math.abs(d) <= 2) return `estável ${comparisonSuffix}`;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d}% ${comparisonSuffix}`;
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
    if (abs === 0) return { label: `estável ${comparisonSuffix}` , type: "neutral" as const };
    const sign = abs > 0 ? "+" : "";
    const unit = Math.abs(abs) === 1 ? "organização" : "organizações";
    return { label: `${sign}${abs} ${unit} ${comparisonSuffix}`, type: abs > 0 ? "positive" as const : "negative" as const };
  })();

  const groupsChange = (() => {
    const curr = kpiGroupsPeriod || 0;
    const prev = kpiGroupsPrevPeriod ?? null;
    if (prev === null) return { label: "—", type: "neutral" as const };
    const abs = curr - prev;
    if (abs === 0) return { label: `estável ${comparisonSuffix}` , type: "neutral" as const };
    const sign = abs > 0 ? "+" : "";
    const unit = Math.abs(abs) === 1 ? "grupo" : "grupos";
    return { label: `${sign}${abs} ${unit} ${comparisonSuffix}`, type: abs > 0 ? "positive" as const : "negative" as const };
  })();

  const activeMembersChange = (() => {
    const curr = kpiActiveMembersPeriod || 0;
    const prev = kpiActiveMembersPrevPeriod ?? null;
    if (prev === null) return { label: "—", type: "neutral" as const };
    if (curr === prev) return { label: "sem variação", type: "neutral" as const };
    if (prev === 0) return { label: `novo ${comparisonSuffix}`, type: "positive" as const };
    const delta = Math.round(((curr - prev) / prev) * 100);
    if (Math.abs(delta) <= 2) return { label: `estável ${comparisonSuffix}`, type: "neutral" as const };
    const sign = delta >= 0 ? "+" : "";
    const type = delta > 0 ? "positive" as const : "negative" as const;
    return { label: `${sign}${delta}% ${comparisonSuffix}`, type };
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
    if (rounded === 0) return { label: "sem variação", type: "neutral" as const };
    if (Math.abs(rounded) <= 2) return { label: `estável ${comparisonSuffix}`, type: "neutral" as const };
    const formatted = `${rounded >= 0 ? "+" : ""}${String(rounded).replace(".", ",")}`;
    const type = rounded > 0 ? "positive" as const : "negative" as const;
    return { label: `${formatted} p.p. ${comparisonSuffix}`, type };
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
    return `Nas últimas 24h: ${newGroupsCount} novos grupos, ${formatNumberBR(totalMessages)} mensagens em ${formatNumberBR(activeGroups)} grupos (concentração ${concentration}).`;
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
        variant="kpi"
      />
      <StatsCard
        title="Membros ativos"
        value={kpiActiveMembersError ? "Erro" : String(kpiActiveMembersPeriod ?? 0)}
        isLoading={kpiActiveMembersLoading}
        change={kpiActiveMembersLoading ? undefined : activeMembersChange.label}
        changeType={activeMembersChange.type}
        icon={UsersIcon}
        variant="kpi"
      />
      <StatsCard
        title="Participação dos membros"
        value={participationValue}
        isLoading={kpiActiveMembersLoading || kpiMembersLoading}
        change={participationChange.label}
        changeType={participationChange.type}
        icon={UsersIcon}
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
        variant="kpi"
      />
      <StatsCard
        title="Grupos monitorados"
        value={kpiGroupsPeriodError ? "Erro" : String(kpiGroupsPeriod ?? 0)}
        isLoading={kpiGroupsPeriodLoading}
        change={kpiGroupsPeriodLoading ? undefined : groupsChange.label}
        changeType={groupsChange.type}
        icon={Layers}
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
            <div className="flex items-center gap-3">
              <PeriodFilter value={selectedPeriod} customRange={customRange} onChange={handlePeriodChange} />
              <span className="text-xs text-muted-foreground">Período (panorama): {periodLabel}</span>
            </div>
          )}
          showClearFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />

        <nav
          aria-label="Navegação da página"
          className="sticky top-16 z-20 -mx-4 sm:-mx-6 border-y border-border bg-background/80 px-4 sm:px-6 py-2 backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {pageSections.map((s) => {
                const isActive = activeSectionId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    aria-label={`Ir para seção ${s.label}`}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "h-8 shrink-0 rounded-md px-3 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {Math.round(scrollProgress)}%
            </div>
          </div>
          <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-border/40">
            <div
              className="h-full bg-primary transition-[width] duration-150"
              style={{ width: `${scrollProgress}%` }}
              aria-hidden="true"
            />
          </div>
        </nav>

        <section className="scroll-mt-32 rounded-2xl bg-card p-4 shadow-sm" id="kpis">
          <SectionHeader
            title="KPIs principais"
            subtitle="Sinais do período selecionado"
            subtitleClassName="font-normal text-muted-foreground/80"
            density="compact"
            titleIcon={Layers}
          />
          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-3">
            {mainKpis}
          </div>
        </section>

        <section className="scroll-mt-32 rounded-2xl border border-border bg-card p-4 shadow-sm" id="executive-summary" aria-busy={newGroups24hLoading || pulse24hLoading ? "true" : undefined}>
          <SectionHeader
            title="Resumo executivo"
            subtitle="Leitura rápida + detalhes do dia"
            subtitleClassName="font-normal text-muted-foreground/80"
            density="compact"
            titleIcon={Activity}
          />

          <div className="mt-2 space-y-3">
            <div className="rounded-lg bg-secondary/25 p-3">
              <p className="text-[13px] leading-relaxed text-card-foreground">
                <span className="font-medium">Leitura rápida:</span> {daySummary}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 px-3">
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="alerts" className="border-border/60">
                  <AccordionTrigger className="text-sm text-muted-foreground hover:text-foreground">
                    <div className="flex items-center gap-2">
                      <span>Alertas (24h)</span>
                      <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium tabular-nums">
                        {alerts24h.length}
                      </Badge>
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
                        <p className="text-[13px] text-muted-foreground">Tudo calmo: nenhuma ação imediata nas últimas 24h.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-live="polite">
                        {alerts24h.map((a, i) => {
                          const ToneIcon = a.tone === "warning" ? AlertTriangle : a.tone === "info" ? Info : Minus;
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
                                  <p className="mt-1 text-[12px] text-muted-foreground leading-snug">{a.description}</p>
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
                      <span>Pulso (24h)</span>
                      <Badge variant="outline" className="h-5 border-border/60 bg-transparent px-2 text-[10px] font-medium text-muted-foreground">
                        Concentração {pulseMeta.concentration}
                      </Badge>
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
                      <div className="rounded-lg bg-secondary/25 p-3">
                        <p className="text-[13px] text-muted-foreground">Ainda não há atividade suficiente nas últimas 24h.</p>
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
                            <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                              Top 4 concentram <span className="font-medium tabular-nums text-card-foreground">{pulseMeta.sharePct}%</span> da conversa
                            </div>
                            <div className="mt-1 text-[12px] leading-snug text-muted-foreground/80">{pulseMeta.insight}</div>
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
                                    <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground/90">
                                      <span className="tabular-nums">{share}%</span> da conversa total
                                    </div>
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
                            <div className="text-[11px] text-muted-foreground/80">Demais grupos (5º ao 10º)</div>
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
                      <span>Novos grupos (24h)</span>
                      <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium tabular-nums">
                        {newGroups24h?.length ?? 0}
                      </Badge>
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
                      <div className="rounded-lg bg-secondary/25 p-3">
                        <p className="text-[13px] text-muted-foreground">Tudo tranquilo: nenhum grupo novo nas últimas 24h.</p>
                      </div>
                    ) : (
                      <div className="space-y-2" aria-live="polite">
                        <div className="text-[11px] text-muted-foreground/80">
                          Leia assim: com mensagens = aquecendo; sem atividade = pode precisar de onboarding.
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
                                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                        <span className="truncate max-w-[26ch]">{g.organizations?.name || "—"}</span>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span className="whitespace-nowrap tabular-nums">{formatHoursAgoLabel(g.createdHoursAgo)}</span>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span className="whitespace-nowrap tabular-nums">{formatNumberBR(g.messages24h)} msg</span>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span className="whitespace-nowrap tabular-nums">1ª às {firstActivityLabel}</span>
                                      </div>
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

        <section className="scroll-mt-32 rounded-2xl bg-card p-4 shadow-sm" id="context">
          <SectionHeader
            title="Contexto do período"
            subtitle="Base monitorada e alcance"
            subtitleClassName="font-normal text-muted-foreground/80"
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
              className="ripple-surface shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98]"
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
