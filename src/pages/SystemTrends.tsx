import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ban, BarChart3, Clock3, Flame, Lightbulb, MessageSquareText, Sparkles, TrendingUp, X } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ExecutiveSectionHeader } from "@/components/dashboard/ExecutiveSectionHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { BorisTable } from "@/components/ui/boris-table";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, type DateRange, type PeriodType } from "@/components/group-dashboard/period-utils";
import { useAuth } from "@/hooks/use-auth";
import { useKeywordBlacklist } from "@/hooks/use-keyword-blacklist";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTickBR, formatPeriodRangeBR } from "@/lib/date";
import { notify } from "@/components/ui/sonner";

import AccessDenied from "./AccessDenied";

type OrganizationOption = {
  id: string;
  name: string;
};

type TrendItem = {
  key: string;
  label: string;
  count: number;
  previousCount: number;
  deltaCount: number;
  groupsImpacted: number;
};

type GroupImpactRow = {
  groupId: string;
  groupName: string;
  organizationName: string;
  messages: number;
  previousMessages: number;
  deltaMessages: number;
  topPain: string;
  topKeyword: string;
};

type TrendsQueryData = {
  groupsCount: number;
  currentTotalMessages: number;
  previousTotalMessages: number;
  hourSeries: Array<{ hour: string; messages: number }>;
  weekdaySeries: Array<{ weekday: string; messages: number }>;
  dailySeries: Array<{ day: string; label: string; messages: number }>;
  topKeywords: TrendItem[];
  topPains: Array<TrendItem & { pct: number }>;
  impactedGroups: GroupImpactRow[];
};

function pctDelta(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
}

function formatDeltaLabel(current: number, previous: number, suffix = "") {
  const delta = pctDelta(current, previous);
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(delta >= 10 ? 0 : 1)}%${suffix}`;
}

function formatCompactCount(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatAbsoluteDelta(value: number, unit: string) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("pt-BR").format(value)} ${unit}`;
}

function getDeltaTone(current: number, previous: number): "positive" | "negative" | "neutral" {
  if (current > previous) return "positive";
  if (current < previous) return "negative";
  return "neutral";
}


export default function SystemTrends() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  const {
    items: keywordBlacklist,
    add: addKeywordToBlacklist,
    remove: removeKeywordFromBlacklist,
  } = useKeywordBlacklist();

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("7d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const currentRange = getDateRange(selectedPeriod, customRange);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();
  const rangeDurationMs = Math.max(1, currentRange.to.getTime() - currentRange.from.getTime() + 1);
  const previousRange = useMemo(() => {
    const prevTo = new Date(currentRange.from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - (rangeDurationMs - 1));
    return { from: prevFrom, to: prevTo };
  }, [currentRange.from, rangeDurationMs]);
  const previousStartISO = previousRange.from.toISOString();
  const previousEndISO = previousRange.to.toISOString();

  const organizationsQuery = useQuery({
    queryKey: ["system-trends-organizations"],
    queryFn: async (): Promise<OrganizationOption[]> => {
      const { data, error } = await supabase.from("organizations").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as OrganizationOption[];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const trendsQuery = useQuery({
    queryKey: ["system-trends", currentStartISO, currentEndISO, previousStartISO, previousEndISO, orgFilter, statusFilter, keywordBlacklist.join(",")],
    queryFn: async (): Promise<TrendsQueryData> => {
      const { data, error } = await (supabase as any).rpc("get_system_trends_snapshot", {
        p_start: currentStartISO,
        p_end: currentEndISO,
        p_prev_start: previousStartISO,
        p_prev_end: previousEndISO,
        p_org_id: orgFilter === "all" ? null : orgFilter,
        p_group_status: statusFilter === "all" ? null : statusFilter,
        p_blacklist: keywordBlacklist,
      });
      if (error) throw error;

      const payload = (data ?? {}) as Record<string, any>;

      return {
        groupsCount: Number(payload.groupsCount ?? 0),
        currentTotalMessages: Number(payload.currentTotalMessages ?? 0),
        previousTotalMessages: Number(payload.previousTotalMessages ?? 0),
        hourSeries: (Array.isArray(payload.hourSeries) ? payload.hourSeries : []).map((item: any) => ({
          hour: String(item.hour ?? "00h"),
          messages: Number(item.messages ?? 0),
        })),
        weekdaySeries: (Array.isArray(payload.weekdaySeries) ? payload.weekdaySeries : []).map((item: any) => ({
          weekday: String(item.weekday ?? "—"),
          messages: Number(item.messages ?? 0),
        })),
        dailySeries: (Array.isArray(payload.dailySeries) ? payload.dailySeries : []).map((item: any) => ({
          day: String(item.day ?? ""),
          label: item.day ? formatDateTickBR(item.day) : "—",
          messages: Number(item.messages ?? 0),
        })),
        topKeywords: (Array.isArray(payload.topKeywords) ? payload.topKeywords : []).map((item: any) => ({
          key: String(item.key ?? ""),
          label: String(item.label ?? ""),
          count: Number(item.count ?? 0),
          previousCount: Number(item.previousCount ?? 0),
          deltaCount: Number(item.deltaCount ?? 0),
          groupsImpacted: Number(item.groupsImpacted ?? 0),
        })),
        topPains: (Array.isArray(payload.topPains) ? payload.topPains : []).map((item: any) => ({
          key: String(item.key ?? ""),
          label: String(item.label ?? ""),
          count: Number(item.count ?? 0),
          previousCount: Number(item.previousCount ?? 0),
          deltaCount: Number(item.deltaCount ?? 0),
          groupsImpacted: Number(item.groupsImpacted ?? 0),
          pct: Number(item.pct ?? 0),
        })),
        impactedGroups: (Array.isArray(payload.impactedGroups) ? payload.impactedGroups : []).map((item: any) => ({
          groupId: String(item.groupId ?? ""),
          groupName: String(item.groupName ?? ""),
          organizationName: String(item.organizationName ?? "—"),
          messages: Number(item.messages ?? 0),
          previousMessages: Number(item.previousMessages ?? 0),
          deltaMessages: Number(item.deltaMessages ?? 0),
          topPain: String(item.topPain ?? "—"),
          topKeyword: String(item.topKeyword ?? "—"),
        })),
      };
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const handlePeriodChange = (period: PeriodType, range: DateRange) => {
    setSelectedPeriod(period);
    setCustomRange(period === "custom" ? range : undefined);
  };

  const handleAddKeywordToBlacklist = (word: string) => {
    addKeywordToBlacklist(word);
    notify.success("Palavra adicionada à blacklist", `"${word}" não aparecerá mais nos rankings desta sessão local.`);
  };

  const handleRemoveKeywordFromBlacklist = (word: string) => {
    removeKeywordFromBlacklist(word);
    notify.success("Palavra removida da blacklist", `"${word}" voltou a ser considerada nos rankings.`);
  };

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Trends" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const data = trendsQuery.data;
  const peakHour = data?.hourSeries.reduce((best, item) => (!best || item.messages > best.messages ? item : best), null as { hour: string; messages: number } | null);
  const peakWeekday = data?.weekdaySeries.reduce((best, item) => (!best || item.messages > best.messages ? item : best), null as { weekday: string; messages: number } | null);
  const topKeyword = data?.topKeywords[0];
  const topPain = data?.topPains[0];
  const hasError = !!trendsQuery.error || !!organizationsQuery.error;
  const filterSummary = `${data?.groupsCount ?? 0} grupos no recorte • ${formatPeriodRangeBR(currentRange.from, currentRange.to)}`;
  const comparisonSummary = `Comparado com ${formatPeriodRangeBR(previousRange.from, previousRange.to)}`;

  const groupColumns = [
    {
      key: "groupName",
      header: "Grupo",
      sortable: true,
      sortValue: (row: GroupImpactRow) => row.groupName,
      render: (row: GroupImpactRow) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{row.groupName}</div>
          <div className="text-xs text-muted-foreground truncate">{row.organizationName}</div>
        </div>
      ),
    },
    {
      key: "messages",
      header: "Mensagens",
      sortable: true,
      render: (row: GroupImpactRow) => <span className="tabular-nums font-semibold">{row.messages}</span>,
    },
    {
      key: "deltaMessages",
      header: "Delta vs anterior",
      sortable: true,
      render: (row: GroupImpactRow) => (
        <span className={row.deltaMessages > 0 ? "text-success" : row.deltaMessages < 0 ? "text-destructive" : "text-muted-foreground"}>
          {formatAbsoluteDelta(row.deltaMessages, "msgs")}
        </span>
      ),
    },
    {
      key: "topPain",
      header: "Dor dominante",
      hideOn: "sm" as const,
      sortable: true,
      render: (row: GroupImpactRow) => <Badge variant="secondary">{row.topPain}</Badge>,
    },
    {
      key: "topKeyword",
      header: "Palavra em alta",
      hideOn: "md" as const,
      sortable: true,
      render: (row: GroupImpactRow) => <span className="text-sm text-muted-foreground">{row.topKeyword}</span>,
    },
  ];

  return (
    <AdminLayout title="System Trends" subtitle="Tendências transversais do ecossistema">
      <div className="space-y-6">
        <AdminPageHeader
          title="Trends do sistema"
          description="Veja ritmo, temas, dores e grupos impactados em um único recorte sistêmico."
          breadcrumbItems={[
            { label: "Central de Comando", href: "/" },
            { label: "Trends" },
          ]}
        />

        <div className="rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-card-foreground">Recorte analítico</div>
              <div className="text-xs text-muted-foreground">{filterSummary}</div>
              <div className="text-xs text-muted-foreground">{comparisonSummary}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PeriodFilter value={selectedPeriod} customRange={customRange} onChange={handlePeriodChange} />
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-full min-w-[200px]">
                  <SelectValue placeholder="Organização" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as organizações</SelectItem>
                  {(organizationsQuery.data ?? []).map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
                <SelectTrigger className="w-full min-w-[200px]">
                  <SelectValue placeholder="Status do grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {trendsQuery.isLoading ? (
          <LoadingState message="Carregando tendências do sistema..." />
        ) : hasError ? (
          <ErrorState
            title="Não foi possível carregar as trends"
            message="O recorte sistêmico não pôde ser montado agora. Tente novamente."
            retry={() => void trendsQuery.refetch()}
          />
        ) : !data || data.groupsCount === 0 ? (
          <EmptyState title="Nenhum grupo no recorte" message="Ajuste os filtros para ver tendências do sistema." />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatsCard
                title="Mensagens no recorte"
                value={formatCompactCount(data.currentTotalMessages)}
                change={`${formatDeltaLabel(data.currentTotalMessages, data.previousTotalMessages)} vs período anterior`}
                changeType={getDeltaTone(data.currentTotalMessages, data.previousTotalMessages)}
                description={`${new Intl.NumberFormat("pt-BR").format(data.previousTotalMessages)} mensagens no período anterior equivalente.`}
                icon={MessageSquareText}
                variant="kpi"
              />
              <StatsCard
                title="Hora mais movimentada"
                value={peakHour?.hour ?? "—"}
                change={peakHour ? `${new Intl.NumberFormat("pt-BR").format(peakHour.messages)} mensagens nesta faixa` : "Sem dados"}
                changeType="neutral"
                description="Maior concentração horária dentro do período atual."
                icon={Clock3}
                variant="kpi"
              />
              <StatsCard
                title="Dia mais movimentado"
                value={peakWeekday?.weekday ?? "—"}
                change={peakWeekday ? `${new Intl.NumberFormat("pt-BR").format(peakWeekday.messages)} mensagens neste dia` : "Sem dados"}
                changeType="neutral"
                description="Dia da semana com maior volume no recorte atual."
                icon={BarChart3}
                variant="kpi"
              />
              <StatsCard
                title="Tema mais aquecido"
                value={topKeyword?.label ?? "—"}
                change={topKeyword ? `${formatAbsoluteDelta(topKeyword.deltaCount, "citações")} vs anterior` : "Sem dados"}
                changeType={topKeyword && topKeyword.deltaCount > 0 ? "positive" : "neutral"}
                description={topKeyword ? `${topKeyword.previousCount} citações no período anterior.` : "Palavra-chave com maior aceleração entre grupos."}
                icon={Sparkles}
                variant="kpi"
              />
            </section>
            <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
                <ExecutiveSectionHeader
                  eyebrow="Ritmo"
                  title="Pulso temporal do sistema"
                  description="Leitura rápida do ritmo diário e das horas de pico entre grupos."
                />
                <div className="mt-5">
                  <ChartContainer
                    config={{ messages: { label: "Mensagens", color: "hsl(var(--primary))" } }}
                    className="h-[280px] w-full"
                  >
                    <AreaChart data={data.dailySeries}>
                      <defs>
                        <linearGradient id="trendsArea" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-messages)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="var(--color-messages)" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="messages" stroke="var(--color-messages)" fill="url(#trendsArea)" strokeWidth={2} />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
                <ExecutiveSectionHeader
                  eyebrow="Distribuição"
                  title="Dias mais aquecidos"
                  description="Concentração das conversas por dia da semana."
                />
                <div className="mt-5">
                  <ChartContainer
                    config={{ messages: { label: "Mensagens", color: "hsl(var(--primary))" } }}
                    className="h-[280px] w-full"
                  >
                    <BarChart data={data.weekdaySeries}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="weekday" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="messages" radius={[10, 10, 0, 0]} fill="var(--color-messages)" />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <div className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
                <ListSectionHeader
                  title="Horários mais movimentados"
                  description="Volume agregado por hora no fuso do produto."
                />
                <div className="mt-5">
                  <ChartContainer
                    config={{ messages: { label: "Mensagens", color: "hsl(var(--primary))" } }}
                    className="h-[280px] w-full"
                  >
                    <BarChart data={data.hourSeries}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={1} angle={-45} textAnchor="end" height={48} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="messages" radius={[8, 8, 0, 0]}>
                        {data.hourSeries.map((entry) => (
                          <Cell
                            key={entry.hour}
                            fill={entry.hour === peakHour?.hour ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
                <ListSectionHeader
                  title="Sinais executivos"
                  description="Resumo do que merece atenção agora."
                />
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary"><TrendingUp className="h-4 w-4" /></div>
                      <div>
                        <div className="text-sm font-semibold text-card-foreground">Ritmo do sistema</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {peakHour?.hour ?? "—"} concentra o maior pico horário, enquanto {peakWeekday?.weekday ?? "—"} é o dia mais carregado neste recorte.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary"><Lightbulb className="h-4 w-4" /></div>
                      <div>
                        <div className="text-sm font-semibold text-card-foreground">Tema em alta</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {topKeyword ? `${topKeyword.label} saiu de ${topKeyword.previousCount} para ${topKeyword.count} citações e já aparece em ${topKeyword.groupsImpacted} grupos.` : "Sem sinal forte de tema neste período."}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary"><Flame className="h-4 w-4" /></div>
                      <div>
                        <div className="text-sm font-semibold text-card-foreground">Dor dominante</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {topPain ? `${topPain.label} saiu de ${topPain.previousCount} para ${topPain.count} ocorrências e representa ${topPain.pct.toFixed(1)}% das mensagens textuais analisadas.` : "Sem dor dominante detectada neste recorte."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
                <ExecutiveSectionHeader
                  eyebrow="Temas"
                  title="Palavras e sinais em alta"
                  description="Termos que mais aceleraram no período atual."
                />
                {keywordBlacklist.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border/70 bg-secondary/20 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Ban className="h-3.5 w-3.5" />
                      Blacklist ativa
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {keywordBlacklist.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() => handleRemoveKeywordFromBlacklist(word)}
                          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-[12px] font-medium text-card-foreground transition-colors hover:bg-secondary"
                        >
                          <span>{word}</span>
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  {data.topKeywords.length === 0 ? (
                    <EmptyState title="Sem palavras em alta" message="Não houve volume suficiente para montar ranking de termos." />
                  ) : data.topKeywords.map((item) => (
                    <div key={item.key} className="rounded-xl border border-border/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-card-foreground">{item.label}</span>
                            <Badge variant="secondary">{item.groupsImpacted} grupos</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.count} citações no recorte atual.
                            {item.previousCount > 0 ? ` Antes: ${item.previousCount}.` : " Termo novo no comparativo."}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={item.deltaCount > 0 ? "text-sm font-semibold text-success" : "text-sm font-semibold text-muted-foreground"}>
                            {formatAbsoluteDelta(item.deltaCount, "citações")}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => handleAddKeywordToBlacklist(item.label)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
                <ExecutiveSectionHeader
                  eyebrow="Dores"
                  title="Demandas em alta"
                  description="Clusterização operacional para detectar pressão sistêmica."
                />
                <div className="mt-4 space-y-3">
                  {data.topPains.length === 0 ? (
                    <EmptyState title="Sem dores em alta" message="Não houve volume textual suficiente para detectar pressão sistêmica no recorte." />
                  ) : data.topPains.map((item) => (
                    <div key={item.key} className="rounded-xl border border-border/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-card-foreground">{item.label}</span>
                            <Badge variant="secondary">{item.pct.toFixed(1)}%</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.count} ocorrências no recorte atual.
                            {item.previousCount > 0 ? ` Antes: ${item.previousCount}.` : " Sem base anterior."}
                          </p>
                        </div>
                        <span className={item.deltaCount > 0 ? "text-sm font-semibold text-success" : "text-sm font-semibold text-muted-foreground"}>
                          {formatAbsoluteDelta(item.deltaCount, "ocorrências")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
              <ExecutiveSectionHeader
                eyebrow="Impacto"
                title="Grupos que puxam a tendência"
                description="A coluna delta compara o período atual com a janela anterior equivalente."
              />
              <div className="mt-5">
                <BorisTable
                  columns={groupColumns}
                  data={data.impactedGroups}
                  keyExtractor={(row) => row.groupId}
                  onRowClick={(row) => navigate(`/groups/${row.groupId}`)}
                  emptyMessage="Nenhum grupo com atividade suficiente no recorte."
                  density="comfortable"
                />
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
