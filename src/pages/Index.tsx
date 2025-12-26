import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Layers, Users as UsersIcon, MessageSquare, ArrowUpRight, ArrowRight } from "lucide-react";
import { countWordsFromRows, extractBigramsFromRows } from "@/utils/keywords";
import { PeriodFilter, PeriodType, DateRange, getDateRange } from "@/components/group-dashboard/PeriodFilter";
 
import { format, addDays, startOfDay, subDays } from "date-fns";
import { formatDateKeySP, getHourSP } from "@/lib/date";

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
  const handlePeriodChange = (period: PeriodType, range: DateRange) => {
    setSelectedPeriod(period);
    if (period === 'custom') setCustomRange(range);
  };
  const [keywordsMode, setKeywordsMode] = useState<'themes'|'words'>('themes');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('system-admin-period');
      if (raw) {
        const saved = JSON.parse(raw);
        const p = saved?.period as PeriodType | undefined;
        if (p) {
          setSelectedPeriod(p);
          if (p === 'custom' && saved?.from && saved?.to) {
            setCustomRange({ from: new Date(saved.from), to: new Date(saved.to) });
          }
        }
      }
    } catch { void 0; }
  }, []);

  useEffect(() => {
    const payload: any = { period: selectedPeriod };
    if (selectedPeriod === 'custom' && customRange?.from && customRange?.to) {
      payload.from = customRange.from.toISOString();
      payload.to = customRange.to.toISOString();
    }
    try {
      localStorage.setItem('system-admin-period', JSON.stringify(payload));
    } catch { void 0; }
  }, [selectedPeriod, customRange]);

  const periodMs = currentRange.to.getTime() - currentRange.from.getTime();
  const periodDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24));
  const prevEnd = new Date(currentRange.from.getTime() - 1);
  const prevFrom = subDays(prevEnd, periodDays - 1);
  const prevStartISO = prevFrom.toISOString();
  const prevEndISO = prevEnd.toISOString();

  

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

  const {
    data: kpiGroupsPeriod,
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
    if (kpiOrgsError) toast.error("Falha ao carregar Organizações");
    if (kpiGroupsError) toast.error("Falha ao carregar Grupos");
    if (kpiMembersError) toast.error("Falha ao carregar Membros");
    if (kpiMessagesError) toast.error("Falha ao carregar Mensagens do período");
    if (kpiActiveMembersError) toast.error("Falha ao carregar Membros ativos");
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
      const { data, error } = await supabase
        .from("messages")
        .select("group_id,member_id")
        .is("deleted_at", null)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString());
      if (error) throw error;
      const counts: Record<string, number> = {};
      const memberSets: Record<string, Set<string>> = {};
      (data || []).forEach((row: any) => {
        const gid = row.group_id as string | null;
        if (!gid) return;
        counts[gid] = (counts[gid] || 0) + 1;
        const mid = row.member_id as string | null;
        if (mid) {
          if (!memberSets[gid]) memberSets[gid] = new Set<string>();
          memberSets[gid].add(mid);
        }
      });
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((acc, [, v]) => acc + v, 0);
      if (entries.length === 0 || total === 0) return null;
      const [topId, topCount] = entries[0];
      const share = Math.round((topCount / total) * 100);
      const topIds = entries.slice(0, 5).map(([id]) => id);

      const { data: topGroupsData } = await supabase
        .from("groups")
        .select("id,name")
        .in("id", topIds);
      const nameMap: Record<string, string> = {};
      (topGroupsData || []).forEach((g: any) => { nameMap[g.id] = g.name; });

      const { data: membersForTop } = await supabase
        .from("members")
        .select("group_id")
        .is("deleted_at", null)
        .in("group_id", topIds);
      const totalMembersByGroup: Record<string, number> = {};
      (membersForTop || []).forEach((m: any) => {
        const gid = m.group_id as string | null;
        if (!gid) return;
        totalMembersByGroup[gid] = (totalMembersByGroup[gid] || 0) + 1;
      });

      const topGroups = entries.slice(0, 5).map(([id, c]) => ({
        id,
        name: nameMap[id] || id,
        count: c,
        activeMembers: memberSets[id]?.size || 0,
        totalMembers: totalMembersByGroup[id] || 0,
      }));

      const { data: group } = await supabase
        .from("groups")
        .select("name")
        .eq("id", topId)
        .maybeSingle();
      return {
        groupId: topId,
        groupName: group?.name || topId,
        share,
        topGroups,
        activeGroups: counts ? Object.keys(counts).length : 0,
      };
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

  const { data: messagesPerDay, isLoading: messagesPerDayLoading } = useQuery({
    queryKey: ["system-messages-per-day", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id,is_active,is_archived")
        .eq("is_active", true)
        .or("is_archived.eq.false,is_archived.is.null");
      const activeGroupIds = (groups || []).map((g: any) => g.id);

      const { data } = await supabase
        .from("messages")
        .select("created_at,group_id")
        .is("deleted_at", null)
        .in("group_id", activeGroupIds)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString())
        .order("created_at", { ascending: true });
      const countsByDay: Record<string, number> = {};
      const periodDays = Math.ceil((currentRange.to.getTime() - currentRange.from.getTime()) / (1000 * 60 * 60 * 24));
      for (let i = periodDays - 1; i >= 0; i--) {
        const date = subDays(currentRange.to, i);
        const key = formatDateKeySP(date);
        countsByDay[key] = 0;
      }
      (data || []).forEach((m: any) => {
        const key = formatDateKeySP(new Date(m.created_at));
        if (countsByDay[key] !== undefined) {
          countsByDay[key] = (countsByDay[key] || 0) + 1;
        }
      });
      return Object.entries(countsByDay).map(([date, count]) => ({ date, count }));
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
    if (signalConcentrationError) toast.error("Falha ao carregar sinal de concentração");
    if (signalKeywordsError) toast.error("Falha ao carregar palavras-chave em alta");
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
    const prev = kpiMessagesPrevPeriod || 0;
    if (!prev) return 0;
    return Math.round(((curr - prev) / prev) * 100);
  })();
  const messagesChangeLabel = (() => {
    const d = messagesDelta;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d}% vs período anterior`;
  })();
  const messagesChangeType = messagesDelta > 0 ? "positive" : messagesDelta < 0 ? "negative" : "neutral";

  const participationValue = (() => { if (kpiActiveMembersLoading || kpiMembersLoading) return "—"; const total = kpiMembers || 0; const actives = kpiActiveMembersPeriod || 0; if (!total) return "0%"; return String(Math.round((actives / total) * 100)) + "%"; })();

  return (
    <AdminLayout 
      title="Dashboard do Sistema — Resumo Geral" 
      subtitle="Panorama geral do Bóris"
      actions={<PeriodFilter value={selectedPeriod} customRange={customRange} onChange={handlePeriodChange} />}
    >
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard title="Organizações ativas" value={kpiOrgsPeriodLoading ? "—" : (kpiOrgsPeriodError ? "Erro" : String(kpiOrgsPeriod ?? 0))} icon={Building2} variant="kpi" />
        <StatsCard title="Grupos monitorados" value={kpiGroupsPeriodLoading ? "—" : (kpiGroupsPeriodError ? "Erro" : String(kpiGroupsPeriod ?? 0))} icon={Layers} variant="kpi" />
        <StatsCard title="Membros ativos" value={kpiActiveMembersLoading ? "—" : (kpiActiveMembersError ? "Erro" : String(kpiActiveMembersPeriod ?? 0))} icon={UsersIcon} variant="kpi" />
        <StatsCard title="Mensagens no período" value={kpiMessagesLoading ? "—" : (kpiMessagesError ? "Erro" : String(kpiMessagesPeriod ?? 0))} change={kpiMessagesLoading ? undefined : messagesChangeLabel} changeType={messagesChangeType} icon={MessageSquare} variant="kpi" />
        <StatsCard title="Participação dos membros" value={participationValue} icon={UsersIcon} variant="kpi" />
      </div>
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-card-foreground">Atenção — o que precisa do seu olhar agora</h3>
          <p className="text-xs text-muted-foreground">Leitura imediata de risco, oportunidade e estado geral.</p>
        </div>

        {(() => {
          const curr = kpiMessagesPeriod || 0;
          const prev = kpiMessagesPrevPeriod || 0;
          const delta = prev ? Math.round(((curr - prev) / prev) * 100) : 0;
          const totalOrgs = kpiOrgs || 0;
          const activeOrgs = kpiOrgsPeriod || 0;
          const inactiveOrgs = Math.max(0, totalOrgs - activeOrgs);
          const hasCriticalDrop = delta <= -20;
          const hasModerateDrop = delta < 0 && delta > -20;
          const topWord = (() => { const words = signalKeywords?.words || []; const sorted = [...words].sort((a: any, b: any) => (b?.delta || 0) - (a?.delta || 0)); return sorted[0]; })();

          return (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-card-foreground">🔴 Problemas detectados</p>
                </div>
                <div className="space-y-2">
                  {hasCriticalDrop && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-card-foreground">Queda brusca no volume de mensagens</span>
                      <span className="ml-auto text-xs font-medium text-destructive">{`${delta}% em relação ao período anterior`}</span>
                      <button onClick={() => navigate('/system/groups')} className="text-xs text-primary hover:underline">ver detalhes →</button>
                    </div>
                  )}
                  {inactiveOrgs > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-card-foreground">{inactiveOrgs} organizações não tiveram nenhuma mensagem neste período</span>
                      <button onClick={() => navigate('/system/organizations')} className="ml-auto text-xs text-primary hover:underline">ver detalhes →</button>
                    </div>
                  )}
                  {!hasCriticalDrop && inactiveOrgs === 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-success">🟢 Nenhum problema encontrado no período</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-card-foreground">🟡 Atenção recomendada</p>
                </div>
                <div className="space-y-2">
                  {hasModerateDrop && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-card-foreground">Mensagens diminuíram em relação ao período anterior</span>
                      <span className="ml-auto text-xs font-medium text-warning">{`${delta}%`}</span>
                      <button onClick={() => navigate('/system/groups')} className="text-xs text-primary hover:underline">ver detalhes →</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-card-foreground">🟢 Boas notícias</p>
                </div>
                <div className="space-y-2">
                  {delta > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-card-foreground">Mensagens cresceram em relação ao período anterior</span>
                      <span className="ml-auto text-xs font-medium text-success">{`+${delta}%`}</span>
                      <button onClick={() => navigate('/system/groups')} className="text-xs text-primary hover:underline">ver detalhes →</button>
                    </div>
                  )}
                  {(() => {
                    const themes = ((signalKeywords?.bigrams || []) as any[])
                      .filter((t: any) => (t?.delta || 0) > 0)
                      .sort((a: any, b: any) => (b.delta || 0) - (a.delta || 0))
                      .slice(0, 3);
                    return themes.map((t: any) => (
                      <div key={t.phrase} className="flex items-center gap-2">
                        <span className="text-sm text-card-foreground">Tema em alta: “{t.phrase}”</span>
                        <span className="ml-auto text-xs font-medium text-success">{`+${t.delta}% vs período anterior`}</span>
                        <button onClick={() => { const el = document.getElementById('keywords'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} className="text-xs text-primary hover:underline">ver detalhes →</button>
                      </div>
                    ));
                  })()}
                  {((signalKeywords?.bigrams || []) as any[]).filter((t: any) => (t?.delta || 0) > 0).length === 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">ℹ️ Nenhum tema relevante em alta neste período.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <Card className="mt-8" id="keywords">
        <CardHeader>
          <CardTitle>Grupos mais ativos</CardTitle>
          <CardDescription>Mensagens por grupo no período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          {signalConcentrationLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!signalConcentrationLoading && signalConcentrationError && (<ErrorState title="Falha ao carregar" message="Não foi possível carregar" retry={refetchConcentration} />)}
          {!signalConcentrationLoading && !signalConcentrationError && signalConcentration && (
            (() => {
              const totalTop = (signalConcentration.topGroups || []).reduce((acc: number, it: any) => acc + (it.count || 0), 0);
              return (
                <div className="space-y-2">
                  {(signalConcentration.topGroups || []).map((g: any, i: number) => {
                    const participation = totalTop ? Math.round((Number(g.count || 0) / totalTop) * 100) : 0;
                    const avgPerDay = (() => { const d = periodDays || 0; return d ? Math.round(Number(g.count || 0) / d) : 0; })();
                    return (
                  <button
                    key={g.id}
                    onClick={() => navigate(`/groups/${g.id}`)}
                    className="w-full text-left rounded-md border border-border bg-card p-3 hover:bg-card/70 transition-colors"
                  >
                    <div className="text-sm font-medium text-card-foreground">{`${i + 1}. ${g.name}`}</div>
                    <div className="mt-1 text-sm text-card-foreground">
                      <span>📩 </span>
                      <span className="font-semibold">{Number(g.count || 0)}</span>
                      <span className="ml-1">msgs</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                      <span className="whitespace-nowrap">👥 {Number(g.activeMembers || 0)} ativos</span>
                      <span className="whitespace-nowrap">📆 {avgPerDay}/dia</span>
                      <span className="whitespace-nowrap">{participation}% do total</span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()
      )}
      </CardContent>
      </Card>

      <Card className="mt-8" id="keywords">
        <CardHeader>
          <CardTitle>Temas em alta</CardTitle>
          <CardDescription>Leitura rápida do período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          {signalKeywordsLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!signalKeywordsLoading && signalKeywordsError && (<ErrorState title="Falha ao carregar" message="Não foi possível carregar" retry={refetchKeywords} />)}
          {!signalKeywordsLoading && !signalKeywordsError && signalKeywords && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {((signalKeywords.bigrams || []) as any[])
                  .filter((k: any) => typeof k.delta === 'number' && k.delta > 0)
                  .sort((a: any, b: any) => (b.delta || 0) - (a.delta || 0))
                  .slice(0, 6)
                  .map((k: any) => (
                    <div key={k.phrase + '-' + k.delta} className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-2 py-1.5">
                      <span className="text-sm font-medium text-card-foreground truncate flex-1">{k.phrase}</span>
                      <span className="text-xs font-medium text-success tabular-nums">{`+${k.delta}%`}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Saúde da plataforma</CardTitle>
          <CardDescription>Status operacional atual</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionStatus />
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default Index;
