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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Layers, Users as UsersIcon, MessageSquare, AlertTriangle, Activity, Tag } from "lucide-react";
import { filterKeywordItems, countWordsFromRows, extractBigramsFromRows } from "@/utils/keywords";
import { PeriodFilter, PeriodType, DateRange, getDateRange } from "@/components/group-dashboard/PeriodFilter";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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
        navigate(`/group/${groups[0]}`, { replace: true });
      } else if (orgs && orgs.length > 0) {
        navigate(`/org/${orgs[0]}`, { replace: true });
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
    refetch: refetchKpiOrgs,
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
    refetch: refetchKpiGroups,
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
    refetch: refetchKpiMembers,
  } = useQuery({
    queryKey: ["kpi-members-total"],
    queryFn: fetchTotalMembersCount,
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: kpiProfiles,
    isLoading: kpiProfilesLoading,
    error: kpiProfilesError,
    refetch: refetchKpiProfiles,
  } = useQuery({
    queryKey: ["kpi-profiles-total"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: kpiMessagesLifetime,
    isLoading: kpiMessagesLifetimeLoading,
    error: kpiMessagesLifetimeError,
    refetch: refetchKpiMessagesLifetime,
  } = useQuery({
    queryKey: ["kpi-messages-lifetime"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: kpiActiveGroups30d,
    isLoading: kpiActiveGroupsLoading,
    error: kpiActiveGroupsError,
    refetch: refetchKpiActiveGroups,
  } = useQuery({
    queryKey: ["kpi-groups-active-30d"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("messages")
        .select("group_id")
        .is("deleted_at", null)
        .gte("created_at", cutoff);
      if (error) throw error;
      const set = new Set((data || []).map((r: any) => r.group_id).filter(Boolean));
      return set.size;
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const {
    data: kpiMessagesPeriod,
    isLoading: kpiMessagesLoading,
    error: kpiMessagesError,
    refetch: refetchKpiMessages,
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

  const {
    data: kpiActiveMembersPeriod,
    isLoading: kpiActiveMembersLoading,
    error: kpiActiveMembersError,
    refetch: refetchActiveMembers,
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

  useEffect(() => {
    if (kpiOrgsError) toast.error("Falha ao carregar Organizações ativas");
    if (kpiGroupsError) toast.error("Falha ao carregar Total de grupos");
    if (kpiMembersError) toast.error("Falha ao carregar Total de membros");
    if (kpiProfilesError) toast.error("Falha ao carregar Total de usuários");
    if (kpiMessagesLifetimeError) toast.error("Falha ao carregar Mensagens totais");
    if (kpiActiveGroupsError) toast.error("Falha ao carregar Grupos ativos (30d)");
    if (kpiActiveMembersError) toast.error("Falha ao carregar Membros ativos (período)");
  }, [
    kpiOrgsError,
    kpiGroupsError,
    kpiMembersError,
    kpiProfilesError,
    kpiMessagesLifetimeError,
    kpiActiveGroupsError,
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
        .select("group_id")
        .is("deleted_at", null)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString());
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const gid = row.group_id as string | null;
        if (!gid) return;
        counts[gid] = (counts[gid] || 0) + 1;
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
      const topGroups = entries.slice(0, 5).map(([id, c]) => ({ id, name: nameMap[id] || id, count: c }));
      const { data: group } = await supabase
        .from("groups")
        .select("name")
        .eq("id", topId)
        .maybeSingle();
      return { groupId: topId, groupName: group?.name || topId, share, topGroups, activeGroups: counts ? Object.keys(counts).length : 0 };
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
      let rows: string[] = [];
      if (!error) {
        rows = (data || []).map((d: any) => d.content_preview || "");
      } else {
        const fb = await supabase
          .from("messages")
          .select("content,message_type,created_at")
          .eq("message_type", "text")
          .gte("created_at", currentRange.from.toISOString())
          .lte("created_at", currentRange.to.toISOString())
          .limit(2000);
        if (fb.error) throw fb.error;
        rows = (fb.data || []).map((d: any) => d.content || "");
      }
      const words = countWordsFromRows(rows).slice(0, 6);
      const bigrams = extractBigramsFromRows(rows).slice(0, 6);
      return { words, bigrams };
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  const { data: messagesPerDay } = useQuery({
    queryKey: ["system-messages-per-day", currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("created_at")
        .is("deleted_at", null)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString())
        .order("created_at", { ascending: true });
      const counts: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        const day = new Date(m.created_at).toISOString().slice(0,10);
        counts[day] = (counts[day] || 0) + 1;
      });
      const days: string[] = [];
      const cursor = new Date(currentRange.from);
      const end = new Date(currentRange.to);
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0,10);
        days.push(key);
        cursor.setDate(cursor.getDate() + 1);
      }
      return days.map(d => ({ date: d, count: counts[d] || 0 }));
    },
    enabled: isAuthenticated && isSystemAdmin,
    retry: 1,
  });

  useEffect(() => {
    if (signalConcentrationError) toast.error("Falha ao carregar sinal de concentração");
    if (signalInactiveError) toast.error("Falha ao carregar grupos inativos (24h)");
    if (signalKeywordsError) toast.error("Falha ao carregar palavras-chave em alta");
  }, [signalConcentrationError, signalInactiveError, signalKeywordsError]);

  const [keywordsMode, setKeywordsMode] = useState<'themes'|'words'>("themes");

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Central de Comando do Sistema" subtitle="Carregando...">
        <PageSkeleton />
      </AdminLayout>
    );
  }

  if (!isAuthenticated || !isSystemAdmin) {
    return null;
  }

  return (
    <AdminLayout title="Central de Comando do Sistema" subtitle="Visão geral do Bóris — estado atual e sinais">
      {/* A) KPIs absolutos */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <StatsCard
            title="Organizações ativas"
            value={kpiOrgsLoading ? "—" : (kpiOrgsError ? "Erro" : String(kpiOrgs ?? 0))}
            icon={Building2}
            variant="compact"
          />
          {kpiOrgsError && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => refetchKpiOrgs()}>Tentar novamente</Button>
            </div>
          )}
        </div>
        <div>
          <StatsCard
            title="Total de grupos"
            value={kpiGroupsLoading ? "—" : (kpiGroupsError ? "Erro" : String(kpiGroups ?? 0))}
            icon={Layers}
            variant="compact"
          />
          {kpiGroupsError && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => refetchKpiGroups()}>Tentar novamente</Button>
            </div>
          )}
        </div>
        <div>
          <StatsCard
            title="Total de membros"
            value={kpiMembersLoading ? "—" : (kpiMembersError ? "Erro" : String(kpiMembers ?? 0))}
            icon={UsersIcon}
            variant="compact"
          />
          {kpiMembersError && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => refetchKpiMembers()}>Tentar novamente</Button>
            </div>
          )}
        </div>
        <div>
          <StatsCard
            title="Usuários (Admin)"
            value={kpiProfilesLoading ? "—" : (kpiProfilesError ? "Erro" : String(kpiProfiles ?? 0))}
            icon={UsersIcon}
            variant="compact"
          />
          {kpiProfilesError && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => refetchKpiProfiles()}>Tentar novamente</Button>
            </div>
          )}
        </div>
        <div>
          <StatsCard
            title="Mensagens totais"
            value={kpiMessagesLifetimeLoading ? "—" : (kpiMessagesLifetimeError ? "Erro" : String(kpiMessagesLifetime ?? 0))}
            icon={MessageSquare}
            variant="compact"
          />
          {kpiMessagesLifetimeError && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => refetchKpiMessagesLifetime()}>Tentar novamente</Button>
            </div>
          )}
        </div>
        <div>
          <StatsCard
            title="Grupos ativos (30d)"
            value={kpiActiveGroupsLoading ? "—" : (kpiActiveGroupsError ? "Erro" : String(kpiActiveGroups30d ?? 0))}
            icon={Layers}
            variant="compact"
          />
          {kpiActiveGroupsError && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => refetchKpiActiveGroups()}>Tentar novamente</Button>
            </div>
          )}
        </div>
      </div>

      {/* B) Filtro de período */}
      <div className="mt-8 flex items-center justify-end">
        <PeriodFilter value={selectedPeriod} customRange={customRange} onChange={handlePeriodChange} />
      </div>

      {/* C) KPIs de atividade (período) */}
      <div className="grid gap-6 lg:grid-cols-4 mt-6">
        <div>
          <StatsCard
            title="Mensagens (período)"
            value={kpiMessagesLoading ? "—" : (kpiMessagesError ? "Erro" : String(kpiMessagesPeriod ?? 0))}
            description="Período selecionado"
            icon={MessageSquare}
          />
          {kpiMessagesError && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => refetchKpiMessages()}>Tentar novamente</Button>
            </div>
          )}
        </div>
        <div>
          <StatsCard
            title="Grupos com atividade"
            value={signalConcentrationLoading ? "—" : (signalConcentrationError ? "Erro" : String(signalConcentration?.activeGroups ?? 0))}
            description="≥ 1 msg no período"
            icon={Layers}
          />
        </div>
        <div>
          <StatsCard
            title="Média msgs por grupo"
            value={(() => {
              if (kpiMessagesLoading || signalConcentrationLoading) return "—";
              const msgs = kpiMessagesPeriod || 0;
              const groups = signalConcentration?.activeGroups || 0;
              if (!groups) return "0";
              return String(Math.round(msgs / groups));
            })()}
            description="Período selecionado"
            icon={MessageSquare}
          />
        </div>
        <div>
          <StatsCard
            title="Dia mais ativo"
            value={(() => {
              const list = messagesPerDay || [];
              if (!list || list.length === 0) return "—";
              const top = [...list].sort((a, b) => b.count - a.count)[0];
              const d = new Date(top.date + 'T00:00:00');
              return d.toLocaleDateString('pt-BR', { weekday: 'long' });
            })()}
            description={(() => {
              const list = messagesPerDay || [];
              if (!list || list.length === 0) return undefined;
              const top = [...list].sort((a, b) => b.count - a.count)[0];
              return `${top.count} msgs`;
            })()}
            icon={Activity}
          />
        </div>
      </div>

      <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Concentração de atividade
            </CardTitle>
            <CardDescription>Distribuição de mensagens no período</CardDescription>
          </CardHeader>
          <CardContent>
            {signalConcentrationLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!signalConcentrationLoading && signalConcentrationError && (
              <ErrorState title="Falha ao carregar" message="Não foi possível carregar este sinal" retry={refetchConcentration} />
            )}
            {!signalConcentrationLoading && !signalConcentrationError && !signalConcentration && (
              <p className="text-sm text-muted-foreground">Sem atividade suficiente para análise</p>
            )}
            {!signalConcentrationLoading && !signalConcentrationError && signalConcentration && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                  <span className="text-sm font-medium text-card-foreground">{signalConcentration.groupName}</span>
                  <span className="text-sm font-semibold">{signalConcentration.share}%</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Top 5 grupos no período</p>
                  {(signalConcentration.topGroups || []).map((g: any) => (
                    <div key={g.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
                      <span className="text-sm text-card-foreground">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Grupos sem atividade (período)
            </CardTitle>
            <CardDescription>Entre grupos ativos</CardDescription>
          </CardHeader>
          <CardContent>
            {signalInactiveLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!signalInactiveLoading && signalInactiveError && (
              <ErrorState title="Falha ao carregar" message="Não foi possível carregar este sinal" retry={refetchInactive} />
            )}
            {!signalInactiveLoading && !signalInactiveError && signalInactive && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total: {signalInactive.count}</p>
                {signalInactive.sample.map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
                    <span className="text-sm text-card-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground">Sem mensagens</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Palavras-chave em alta
            </CardTitle>
            <CardDescription>Período selecionado — todos os grupos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-2 gap-1">
              <button
                onClick={() => setKeywordsMode('themes')}
                className={`text-xs px-2 py-1 rounded border ${keywordsMode==='themes' ? 'bg-secondary text-card-foreground' : 'text-muted-foreground'}`}
              >Temas</button>
              <button
                onClick={() => setKeywordsMode('words')}
                className={`text-xs px-2 py-1 rounded border ${keywordsMode==='words' ? 'bg-secondary text-card-foreground' : 'text-muted-foreground'}`}
              >Palavras</button>
            </div>
            {signalKeywordsLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!signalKeywordsLoading && signalKeywordsError && (
              <ErrorState title="Falha ao carregar" message="Não foi possível carregar este sinal" retry={refetchKeywords} />
            )}
            {!signalKeywordsLoading && !signalKeywordsError && signalKeywords && (
              <div className="space-y-2">
                {(keywordsMode==='themes' ? (signalKeywords.bigrams || []) : filterKeywordItems(signalKeywords.words || [])).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem termos em destaque no período</p>
                ) : (
                  (keywordsMode==='themes' 
                    ? (signalKeywords.bigrams || []).map((item: any) => (
                        <div key={item.phrase} className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
                          <span className="text-sm text-card-foreground">{item.phrase}</span>
                          <span className="text-xs text-muted-foreground">{item.count}</span>
                        </div>
                      ))
                    : filterKeywordItems(signalKeywords.words || []).map((item: any) => (
                        <div key={item.word} className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
                          <span className="text-sm text-card-foreground">{item.word}</span>
                          <span className="text-xs text-muted-foreground">{item.count}</span>
                        </div>
                      ))
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* D) KPIs de engajamento (período) */}
        <div className="grid gap-6 lg:grid-cols-3 mt-4">
          <div>
            <StatsCard
              title="Membros ativos"
              value={kpiActiveMembersLoading ? "—" : (kpiActiveMembersError ? "Erro" : String(kpiActiveMembersPeriod ?? 0))}
              description="≥ 1 msg no período"
              icon={UsersIcon}
            />
            {kpiActiveMembersError && (
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => refetchActiveMembers()}>Tentar novamente</Button>
              </div>
            )}
          </div>
          <div>
            <StatsCard
              title="% de membros ativos"
              value={(() => {
                if (kpiActiveMembersLoading || kpiMembersLoading) return "—";
                const total = kpiMembers || 0;
                const actives = kpiActiveMembersPeriod || 0;
                if (!total) return "0%";
                return String(Math.round((actives / total) * 100)) + "%";
              })()}
              description="Período selecionado"
              icon={UsersIcon}
            />
          </div>
          <div>
            <StatsCard
              title="Média ativos por grupo"
              value={(() => {
                if (kpiActiveMembersLoading || signalConcentrationLoading) return "—";
                const actives = kpiActiveMembersPeriod || 0;
                const groups = signalConcentration?.activeGroups || 0;
                if (!groups) return "0";
                return String(Math.round(actives / groups));
              })()}
              description="Período selecionado"
              icon={UsersIcon}
            />
          </div>
        </div>

        {/* E) Gráfico simples de mensagens por dia */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Mensagens por dia
            </CardTitle>
            <CardDescription>Período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            {(!messagesPerDay || messagesPerDay.length === 0) ? (
              <p className="text-sm text-muted-foreground">Sem dados para o período</p>
            ) : (
              <ChartContainer
                config={{}}
                className="h-[220px] w-full"
              >
                <LineChart data={messagesPerDay} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Ações de gestão
          </CardTitle>
          <CardDescription>Atalhos principais</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <button onClick={() => navigate("/system/organizations")} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Organizações</p>
              <p className="text-xs text-muted-foreground">Criar e gerenciar</p>
            </div>
          </button>
          <button onClick={() => navigate("/system/groups")} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Grupos</p>
              <p className="text-xs text-muted-foreground">Criar e gerenciar</p>
            </div>
          </button>
          <button onClick={() => navigate("/system/users")} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UsersIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Usuários</p>
              <p className="text-xs text-muted-foreground">Papéis e acesso</p>
            </div>
          </button>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="mt-6">
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
