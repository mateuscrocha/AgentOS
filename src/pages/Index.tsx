import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
 
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { Building2, Layers, Users as UsersIcon, MessageSquare, ArrowUpRight, ChevronRight } from "lucide-react";
import { PeriodReportSystem } from "@/components/dashboard/PeriodReport";
import { countWordsFromRows, extractBigramsFromRows } from "@/utils/keywords";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { SectionHeader } from "@/components/group-dashboard/SectionHeader";
import {
  PeriodType,
  DateRange,
  getDateRange,
  parseStoredPeriod,
  buildStoredPeriod,
} from "@/components/group-dashboard/period-utils";
 
import { format, addDays, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { formatDateKeySP, getHourSP, formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";

type RecentGroupRow = {
  id: string;
  name: string;
  created_at: string;
  organization_id: string;
  organizations?: { name: string } | null;
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
  const [keywordsMode, setKeywordsMode] = useState<'themes'|'words'>('themes');

  const formatNumberBR = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

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

  const periodMs = currentRange.to.getTime() - currentRange.from.getTime();
  const periodDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24));

  const computeComparisonRange = () => {
    const now = new Date();
    const currFrom = currentRange.from;
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
    return { currFrom, currTo, prevFrom, prevTo };
  };

  const { currFrom, currTo, prevFrom, prevTo } = computeComparisonRange();
  const prevStartISO = prevFrom.toISOString();
  const prevEndISO = prevTo.toISOString();

  const getComparisonSuffix = () => {
    switch (selectedPeriod) {
      default:
        return 'vs período anterior';
    }
  };
  const comparisonSuffix = getComparisonSuffix();

  

  const fetchActiveOrganizationsCount = async () => {
    const { count, error } = await supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .or("status.eq.active,status.is.null");
    if (error) throw error;
    return count ?? 0;
  };

  const fetchTotalGroupsCount = async () => {
    const { count, error } = await supabase
      .from("groups")
      .select("*", { count: "exact", head: true })
      .or("is_archived.eq.false,is_archived.is.null");
    if (error) throw error;
    return count ?? 0;
  };

  const fetchTotalMembersCount = async () => {
    const { count, error } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);
    if (error) throw error;
    return count ?? 0;
  };

  const fetchRecentGroups = async () => {
    const { data, error } = await supabase
      .from("groups")
      .select("id, name, created_at, organization_id, organizations(name)")
      .is("deleted_at", null)
      .or("is_archived.eq.false,is_archived.is.null")
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) throw error;
    return (data ?? []) as RecentGroupRow[];
  };

  

  const {
    data: kpiOrgs,
    isLoading: kpiOrgsLoading,
    error: kpiOrgsError,
  } = useQuery({
    queryKey: ["kpi-organizations-active"],
    queryFn: fetchActiveOrganizationsCount,
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: kpiGroups,
    isLoading: kpiGroupsLoading,
    error: kpiGroupsError,
  } = useQuery({
    queryKey: ["kpi-groups-total"],
    queryFn: fetchTotalGroupsCount,
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

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
    data: recentGroups,
    isLoading: recentGroupsLoading,
    error: recentGroupsError,
    refetch: refetchRecentGroups,
  } = useQuery({
    queryKey: ["system-recent-groups"],
    queryFn: fetchRecentGroups,
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

  const { data: newMembersPeriod } = useQuery({
    queryKey: ["kpi-new-members-period", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const { data: newMembersPrevPeriod } = useQuery({
    queryKey: ["kpi-new-members-prev-period", prevStartISO, prevEndISO],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .gte("created_at", prevStartISO)
        .lte("created_at", prevEndISO);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  useEffect(() => {
    if (kpiOrgsError) notify.error("Falha ao carregar Organizações", "Tente novamente.");
    if (kpiGroupsError) notify.error("Falha ao carregar Grupos", "Tente novamente.");
    if (kpiMembersError) notify.error("Falha ao carregar Membros", "Tente novamente.");
    if (kpiMessagesError) notify.error("Falha ao carregar Mensagens do período", "Tente novamente.");
    if (kpiActiveMembersError) notify.error("Falha ao carregar Membros ativos", "Tente novamente.");
  }, [
    kpiOrgsError,
    kpiGroupsError,
    kpiMembersError,
    kpiMessagesError,
    kpiActiveMembersError,
  ]);


  const {
    data: signalConcentration,
    isLoading: signalConcentrationLoading,
    error: signalConcentrationError,
    refetch: refetchConcentration,
  } = useQuery({
    queryKey: ["signal-concentration", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_system_signal_concentration", {
        p_start: currentRange.from.toISOString(),
        p_end: currentRange.to.toISOString(),
        p_limit: 5,
      });
      if (error) throw error;
      return data as unknown as SignalConcentrationPayload;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  

  const {
    data: signalKeywords,
    isLoading: signalKeywordsLoading,
    error: signalKeywordsError,
    refetch: refetchKeywords,
  } = useQuery({
    queryKey: ["signal-trending-keywords", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_messages_feed")
        .select("content_preview,message_type,created_at")
        .eq("message_type", "text")
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString())
        .limit(2000);
      let currRows: string[] = [];
      if (!error) {
        currRows = (data || []).map((d: any) => d.content_preview || "");
      } else {
        const fb = await supabase
          .from("messages")
          .select("content,message_type,created_at")
          .eq("message_type", "text")
          .gte("created_at", currentRange.from.toISOString())
          .lte("created_at", currentRange.to.toISOString())
          .limit(2000);
        if (fb.error) throw fb.error;
        currRows = (fb.data || []).map((d: any) => d.content || "");
      }

      const prevQuery = await supabase
        .from("v_messages_feed")
        .select("content_preview,message_type,created_at")
        .eq("message_type", "text")
        .gte("created_at", prevStartISO)
        .lte("created_at", prevEndISO)
        .limit(2000);
      let prevRows: string[] = [];
      if (!prevQuery.error) {
        prevRows = (prevQuery.data || []).map((d: any) => d.content_preview || "");
      } else {
        const fbPrev = await supabase
          .from("messages")
          .select("content,message_type,created_at")
          .eq("message_type", "text")
          .gte("created_at", prevStartISO)
          .lte("created_at", prevEndISO)
          .limit(2000);
        if (fbPrev.error) throw fbPrev.error;
        prevRows = (fbPrev.data || []).map((d: any) => d.content || "");
      }

      const currCounts = countWordsFromRows(currRows);
      const prevCounts = countWordsFromRows(prevRows);
      const prevMap: Record<string, number> = {};
      (prevCounts || []).forEach((w) => { prevMap[w.word] = Number(w.count || 0); });
      const words = (currCounts || [])
        .map((w) => {
          const prev = prevMap[w.word] || 0;
          const delta = prev ? Math.round(((Number(w.count || 0) - prev) / prev) * 100) : (w.count ? 100 : 0);
          return { word: w.word, count: Number(w.count || 0), delta };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const currBigrams = extractBigramsFromRows(currRows);
      const prevBigrams = extractBigramsFromRows(prevRows);
      const prevBigramMap: Record<string, number> = {};
      (prevBigrams || []).forEach((b) => { prevBigramMap[b.phrase] = Number(b.count || 0); });
      const bigrams = (currBigrams || [])
        .map((b) => {
          const prev = prevBigramMap[b.phrase] || 0;
          const delta = prev ? Math.round(((Number(b.count || 0) - prev) / prev) * 100) : (b.count ? 100 : 0);
          return { phrase: b.phrase, count: Number(b.count || 0), delta };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      return { words, bigrams };
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const { data: peakData, isLoading: peakLoading } = useQuery({
    queryKey: ["system-peak-hour", currentRange.from.toISOString(), currentRange.to.toISOString(), prevStartISO, prevEndISO],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id,is_active,is_archived")
        .eq("is_active", true)
        .or("is_archived.eq.false,is_archived.is.null");
      const activeGroupIds = (groups || []).map((g: any) => g.id);

      const { data: curr } = await supabase
        .from("messages")
        .select("created_at,group_id")
        .is("deleted_at", null)
        .in("group_id", activeGroupIds)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString())
        .order("created_at", { ascending: true });
      const hourCounts: number[] = Array.from({ length: 24 }, () => 0);
      (curr || []).forEach((m: any) => {
        const h = getHourSP(m.created_at);
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      });
      const peakHour = hourCounts.reduce((maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx), 0);
      const peakHourMessages = hourCounts[peakHour] || 0;

      const { data: prev } = await supabase
        .from("messages")
        .select("created_at,group_id")
        .is("deleted_at", null)
        .in("group_id", activeGroupIds)
        .gte("created_at", prevStartISO)
        .lte("created_at", prevEndISO)
        .order("created_at", { ascending: true });
      const prevHourCounts: number[] = Array.from({ length: 24 }, () => 0);
      (prev || []).forEach((m: any) => {
        const h = getHourSP(m.created_at);
        prevHourCounts[h] = (prevHourCounts[h] || 0) + 1;
      });
      const previousPeakHour = prevHourCounts.reduce((maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx), 0);
      const previousPeakHourMessages = prevHourCounts[previousPeakHour] || 0;

      return { peakHour, peakHourMessages, previousPeakHour, previousPeakHourMessages };
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

 

  useEffect(() => {
    if (signalConcentrationError) notify.error("Falha ao carregar sinal de concentração", "Tente novamente.");
    if (signalKeywordsError) notify.error("Falha ao carregar palavras-chave em alta", "Tente novamente.");
  }, [signalConcentrationError, signalKeywordsError]);

 

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
    const base = Math.max(prev, 1);
    return Math.round(((curr - prev) / base) * 100);
  })();
  const messagesChangeLabel = (() => {
    const prev = kpiMessagesPrevPeriod ?? null;
    if (prev === null) return "—";
    const curr = kpiMessagesPeriod || 0;
    if (curr === prev) return "sem variação";
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
    const base = Math.max(prev, 1);
    const delta = Math.round(((curr - prev) / base) * 100);
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

  return (
    <AdminLayout 
      title="Central do Bóris" 
      subtitle="Panorama geral do Bóris"
    >
      <div className="space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central do Bóris" }]}
          title="Central do Bóris"
          description="Panorama geral do Bóris"
          filters={(
            <div className="flex items-center gap-3">
              <PeriodFilter value={selectedPeriod} customRange={customRange} onChange={handlePeriodChange} />
              <span className="text-xs text-muted-foreground">Período: {periodLabel}</span>
            </div>
          )}
          showClearFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          filteredKpis={(
            <>
              <StatsCard title="Organizações ativas" value={kpiOrgsPeriodLoading ? "—" : (kpiOrgsPeriodError ? "Erro" : String(kpiOrgsPeriod ?? 0))} change={kpiOrgsPeriodLoading ? undefined : orgsChange.label} changeType={orgsChange.type} icon={Building2} variant="kpi" />
              <StatsCard title="Grupos monitorados" value={kpiGroupsPeriodLoading ? "—" : (kpiGroupsPeriodError ? "Erro" : String(kpiGroupsPeriod ?? 0))} change={kpiGroupsPeriodLoading ? undefined : groupsChange.label} changeType={groupsChange.type} icon={Layers} variant="kpi" />
              <StatsCard title="Membros ativos" value={kpiActiveMembersLoading ? "—" : (kpiActiveMembersError ? "Erro" : String(kpiActiveMembersPeriod ?? 0))} change={kpiActiveMembersLoading ? undefined : activeMembersChange.label} changeType={activeMembersChange.type} icon={UsersIcon} variant="kpi" />
              <StatsCard title="Mensagens no período" value={kpiMessagesLoading ? "—" : (kpiMessagesError ? "Erro" : String(kpiMessagesPeriod ?? 0))} change={kpiMessagesLoading ? undefined : messagesChangeLabel} changeType={messagesChangeType} icon={MessageSquare} variant="kpi" />
              <StatsCard title="Participação dos membros" value={participationValue} change={participationChange.label} changeType={participationChange.type} icon={UsersIcon} variant="kpi" />
            </>
          )}
        />

        <PeriodReportSystem
          messagesCurrent={kpiMessagesPeriod || 0}
          messagesPrev={kpiMessagesPrevPeriod || 0}
          activeMembersCurrent={kpiActiveMembersPeriod || 0}
          totalMembers={kpiMembers || 0}
          activeOrgsCurrent={kpiOrgsPeriod || 0}
          totalOrgs={kpiOrgs || 0}
          trendingBigrams={(signalKeywords?.bigrams || []) as any}
        />

        <section className="rounded-xl border border-border bg-card p-5" id="recent-groups">
          <SectionHeader
            title="Últimos grupos incluídos"
            subtitle="Novos grupos adicionados ao sistema"
            linkHref="/system/groups"
            linkLabel="Ver todos"
          />

          {recentGroupsLoading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[58px] rounded-lg border border-border bg-secondary/30" />
              ))}
            </div>
          ) : recentGroupsError ? (
            <div className="mt-3">
              <ErrorState title="Falha ao carregar" message="Não foi possível carregar os grupos recentes." retry={refetchRecentGroups} />
            </div>
          ) : !recentGroups || recentGroups.length === 0 ? (
            <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-4">
              <p className="text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {recentGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/groups/${g.id}`)}
                  className="w-full text-left rounded-lg border border-border bg-card/50 p-3 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-card-foreground truncate">{g.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        <span className="whitespace-nowrap">{g.organizations?.name || "—"}</span>
                        <span className="whitespace-nowrap">Incluído em {formatDateSimpleBR(g.created_at)}</span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5" id="keywords">
          <SectionHeader
            title="Grupos mais ativos"
            subtitle="Mensagens por grupo no período selecionado"
          />

          {signalConcentrationLoading ? (
            <div className="mt-4 space-y-3" aria-live="polite" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-8/12" />
                      <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : signalConcentrationError ? (
            <div className="mt-3">
              <ErrorState title="Falha ao carregar" message="Não foi possível carregar os grupos mais ativos." retry={refetchConcentration} />
            </div>
          ) : !signalConcentration || !signalConcentration.topGroups || signalConcentration.topGroups.length === 0 ? (
            <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-4">
              <p className="text-sm text-muted-foreground">Ainda não há atividade suficiente no período selecionado.</p>
            </div>
          ) : (
            (() => {
              const totalMessages = Number(signalConcentration.totalMessages || 0);
              const activeGroups = Number(signalConcentration.activeGroups || 0);
              const totalMessagesLabel = formatNumberBR(totalMessages);
              const activeGroupsLabel = formatNumberBR(activeGroups);

              return (
                <div className="mt-4 space-y-3" aria-live="polite">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-card-foreground tabular-nums">{totalMessagesLabel}</span> mensagens •{" "}
                      <span className="font-medium text-card-foreground tabular-nums">{activeGroupsLabel}</span> grupos com atividade
                    </div>
                    <div className="text-[11px] text-muted-foreground">Top 5 por volume</div>
                  </div>

                  <ul className="space-y-2" role="list">
                    {signalConcentration.topGroups.map((g, i) => {
                      const count = Number(g.count || 0);
                      const participation = totalMessages ? Math.round((count / totalMessages) * 100) : 0;
                      const avgPerDay = periodDays ? Math.round(count / periodDays) : 0;
                      const metricsId = `active-group-metrics-${g.id}`;

                      return (
                        <li key={g.id} role="listitem">
                          <button
                            type="button"
                            onClick={() => navigate(`/groups/${g.id}`)}
                            aria-label={`Abrir dashboard do grupo ${g.name}`}
                            aria-describedby={metricsId}
                            className="group w-full min-h-[72px] text-left rounded-lg border border-border bg-card/50 p-3 transition-colors transition-transform duration-150 ease-out hover:bg-secondary/40 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-card-foreground truncate">
                                  {i + 1}. {g.name}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" id={metricsId}>
                                  <span className="whitespace-nowrap tabular-nums">{formatNumberBR(Number(g.activeMembers || 0))} ativos</span>
                                  <span className="whitespace-nowrap tabular-nums">{formatNumberBR(avgPerDay)}/dia</span>
                                  <span className="whitespace-nowrap tabular-nums">{participation}% do total</span>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-2">
                                <div className="text-right">
                                  <div className="text-base font-semibold text-card-foreground tabular-nums">
                                    {formatNumberBR(count)}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">msgs</div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                              </div>
                            </div>

                            <div className="mt-3 h-2 w-full rounded bg-muted" aria-hidden="true">
                              <div className="h-2 rounded bg-primary" style={{ width: `${Math.max(0, Math.min(100, participation))}%` }} />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()
          )}

        </section>

      </div>
    </AdminLayout>
  );
};

export default Index;
