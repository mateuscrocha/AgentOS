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
import { Building2, Layers, Users as UsersIcon, MessageSquare } from "lucide-react";
import { countWordsFromRows, extractBigramsFromRows } from "@/utils/keywords";
import { PeriodFilter, PeriodType, DateRange, getDateRange } from "@/components/group-dashboard/PeriodFilter";
 
import { format, addDays, startOfDay, subDays } from "date-fns";
import { formatDateKeySP, getHourSP } from "@/lib/date";
import { ConversationRhythmSection } from "@/components/group-dashboard/ConversationRhythmSection";

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

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const currentRange = getDateRange(selectedPeriod, customRange);
  const handlePeriodChange = (period: PeriodType, range: DateRange) => {
    setSelectedPeriod(period);
    if (period === 'custom') setCustomRange(range);
  };

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
    data: signalInactive,
    isLoading: signalInactiveLoading,
    error: signalInactiveError,
    refetch: refetchInactive,
  } = useQuery({
    queryKey: ["signal-inactive-groups", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id,name,is_active,is_archived")
        .eq("is_active", true)
        .or("is_archived.eq.false,is_archived.is.null");
      const { data: msgs } = await supabase
        .from("messages")
        .select("group_id")
        .is("deleted_at", null)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString());
      const activeIds = new Set((msgs || []).map((m: any) => m.group_id).filter(Boolean));
      const list = (groups || []).filter(g => !activeIds.has(g.id)).slice(0, 3);
      return {
        count: (groups || []).filter(g => !activeIds.has(g.id)).length,
        sample: list.map(g => ({ id: g.id, name: g.name })),
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
        .slice(0, 6);

      const bigrams = extractBigramsFromRows(currRows).slice(0, 6);
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
    if (signalInactiveError) toast.error("Falha ao carregar grupos inativos (24h)");
    if (signalKeywordsError) toast.error("Falha ao carregar palavras-chave em alta");
  }, [signalConcentrationError, signalInactiveError, signalKeywordsError]);

 

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

  return (
    <AdminLayout title="Central do Bóris" subtitle="Resumo do período selecionado">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard title="Organizações" value={kpiOrgsLoading ? "—" : (kpiOrgsError ? "Erro" : String(kpiOrgs ?? 0))} icon={Building2} variant="kpi" />
        <StatsCard title="Grupos" value={kpiGroupsLoading ? "—" : (kpiGroupsError ? "Erro" : String(kpiGroups ?? 0))} icon={Layers} variant="kpi" />
        <StatsCard title="Membros" value={kpiMembersLoading ? "—" : (kpiMembersError ? "Erro" : String(kpiMembers ?? 0))} icon={UsersIcon} variant="kpi" />
        <StatsCard title="Mensagens no período selecionado" value={kpiMessagesLoading ? "—" : (kpiMessagesError ? "Erro" : String(kpiMessagesPeriod ?? 0))} icon={MessageSquare} variant="kpi" />
        <StatsCard title="Participação dos membros" value={(() => { if (kpiActiveMembersLoading || kpiMembersLoading) return "—"; const total = kpiMembers || 0; const actives = kpiActiveMembersPeriod || 0; if (!total) return "0%"; return String(Math.round((actives / total) * 100)) + "%"; })()} icon={UsersIcon} variant="kpi" />
      </div>

      <div className="mt-8 flex items-center justify-end">
        <PeriodFilter value={selectedPeriod} customRange={customRange} onChange={handlePeriodChange} />
      </div>

      <div className="mt-8">
        <ConversationRhythmSection 
          messagesPerDay={(messagesPerDay || [])}
          peakHour={peakData?.peakHour}
          peakHourMessages={peakData?.peakHourMessages}
          previousPeakHour={peakData?.previousPeakHour}
          previousPeakHourMessages={peakData?.previousPeakHourMessages}
          isLoading={messagesPerDayLoading || peakLoading}
          periodLabel={"período selecionado"}
        />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Atenção</CardTitle>
          <CardDescription>O que merece cuidado agora</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(() => { const curr = kpiMessagesPeriod || 0; const prev = kpiMessagesPrevPeriod || 0; const delta = prev ? Math.round(((curr - prev) / prev) * 100) : 0; return delta < -20 ? (<div className="rounded-md border border-border bg-card p-3"><p className="text-sm font-medium text-card-foreground">Queda de atividade</p><p className="text-xs text-muted-foreground">{`${delta}% vs período anterior`}</p></div>) : null; })()}
            {(() => { const curr = newMembersPeriod || 0; const prev = newMembersPrevPeriod || 0; const delta = prev ? Math.round(((curr - prev) / prev) * 100) : (curr ? 100 : 0); return Math.abs(delta) > 50 ? (<div className="rounded-md border border-border bg-card p-3"><p className="text-sm font-medium text-card-foreground">Variação de membros</p><p className="text-xs text-muted-foreground">{`${delta}% vs período anterior`}</p></div>) : null; })()}
            {signalInactive && signalInactive.count > 0 ? (
              <div className="rounded-md border border-border bg-card p-3"><p className="text-sm font-medium text-card-foreground">Grupos sem mensagens no período</p><p className="text-xs text-muted-foreground">{`${signalInactive.count} grupos`}</p></div>
            ) : null}
            {(() => {
              const words = signalKeywords?.words || [];
              const sorted = [...words].sort((a: any, b: any) => (b?.delta || 0) - (a?.delta || 0));
              const top = sorted[0];
              return top && (top.delta || 0) > 50 ? (
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="text-sm font-medium text-card-foreground">Palavras mais usadas</p>
                  <p className="text-xs text-muted-foreground">{`${top.word} · +${top.delta}%`}</p>
                </div>
              ) : null;
            })()}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Grupos mais ativos</CardTitle>
          <CardDescription>Mensagens por grupo no período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          {signalConcentrationLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!signalConcentrationLoading && signalConcentrationError && (<ErrorState title="Falha ao carregar" message="Não foi possível carregar" retry={refetchConcentration} />)}
          {!signalConcentrationLoading && !signalConcentrationError && signalConcentration && (
            <div className="space-y-2">
              {(signalConcentration.topGroups || []).map((g: any, i: number) => (
                <div key={g.id} className="grid grid-cols-12 items-center rounded-md border border-border bg-card p-3">
                  <div className="col-span-5 text-sm text-card-foreground">{`${i+1}. ${g.name}`}</div>
                  <div className="col-span-3 text-sm text-muted-foreground">{g.count} msgs</div>
                  <div className="col-span-2 text-sm text-muted-foreground">{(() => { const total = (signalConcentration.topGroups || []).reduce((acc: number, it: any) => acc + it.count, 0); return total ? Math.round((g.count / total) * 100) + '%' : '0%'; })()}</div>
                  <div className="col-span-2 text-sm text-muted-foreground">{`${g.activeMembers || 0} / ${g.totalMembers || 0}`}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Palavras mais usadas</CardTitle>
          <CardDescription>No período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {signalKeywordsLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!signalKeywordsLoading && signalKeywordsError && (<ErrorState title="Falha ao carregar" message="Não foi possível carregar" retry={refetchKeywords} />)}
            {!signalKeywordsLoading && !signalKeywordsError && signalKeywords && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(signalKeywords.words || []).map((w: any) => (
                  <div key={w.word} className="flex items-center justify-between rounded-md border border-border bg-card p-2">
                    <span className="text-sm text-card-foreground">{w.word}</span>
                    <span className="text-xs text-muted-foreground">{w.count}{typeof w.delta === 'number' ? ` · ${w.delta > 0 ? '+' : ''}${w.delta}%` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Grupos sem mensagens no período</CardTitle>
          <CardDescription>Sem mensagens no período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          {signalInactiveLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!signalInactiveLoading && signalInactiveError && (<ErrorState title="Falha ao carregar" message="Não foi possível carregar" retry={refetchInactive} />)}
          {!signalInactiveLoading && !signalInactiveError && signalInactive && (
            <div className="space-y-1">
              {signalInactive.sample.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-card p-2">
                  <span className="text-sm text-card-foreground">{item.name}</span>
                  <span className="text-xs text-muted-foreground">Sem mensagens</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Atalhos rápidos</CardTitle>
          <CardDescription>Principais atalhos</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <button onClick={() => navigate("/system/organizations")} className="flex items-center gap-3 p-4 rounded-md border border-border bg-card text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Gerenciar organizações</p>
            </div>
          </button>
          <button onClick={() => navigate("/system/groups")} className="flex items-center gap-3 p-4 rounded-md border border-border bg-card text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Gerenciar grupos</p>
            </div>
          </button>
          <button onClick={() => navigate("/system/users")} className="flex items-center gap-3 p-4 rounded-md border border-border bg-card text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <UsersIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Gerenciar usuários</p>
            </div>
          </button>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="mt-8">
        <AccordionItem value="health">
          <AccordionTrigger>Saúde do sistema</AccordionTrigger>
          <AccordionContent>
            <ConnectionStatus />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </AdminLayout>
  );
};

export default Index;
