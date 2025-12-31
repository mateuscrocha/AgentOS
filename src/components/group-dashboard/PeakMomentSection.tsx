import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, Clock, Search, TrendingDown, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";
import { MessageDetailsDrawer } from "@/components/messages/MessageDetailsDrawer";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

type DeltaTone = "up" | "down" | "flat";

const getDeltaTone = (delta: number): DeltaTone => {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
};

const formatSigned = (n: number) => {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("pt-BR")}`;
};

const formatSignedPercent = (n: number) => {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
};

function DeltaLabel({ current, previous, kind }: { current: number; previous: number; kind: "percent" | "absolute" }) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const delta = current - previous;
  const tone = getDeltaTone(delta);
  const percent = (delta / previous) * 100;

  const value = kind === "percent" ? formatSignedPercent(percent) : formatSigned(delta);
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : null;
  const className =
    tone === "up" ? "text-emerald-700" : tone === "down" ? "text-rose-700" : "text-muted-foreground";

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${className}`}>
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{value}</span>
      <span className="sr-only">em relação ao período anterior</span>
    </span>
  );
}

type PeakMomentResponse = {
  interval: {
    start_pico: string;
    end_pico: string;
  };
  kpis: {
    total_messages: number;
    unique_participants: number;
    intensity: number;
  };
  top_participants: Array<{
    sender_id: string | null;
    sender_name: string;
    messages_count: number;
    percent_of_total: number;
  }>;
  top_terms: Array<{
    term: string;
    frequency: number;
  }>;
  representative_messages: Array<{
    message_id: string;
    sender_name: string;
    created_at: string;
    preview_text: string;
  }>;
  summary?: string | null;
};

export function PeakMomentSection({
  groupId,
  startDate,
  endDate,
  messagesPerDay: _messagesPerDay = [],
  isDashboardLoading,
}: {
  groupId: string;
  startDate: Date;
  endDate: Date;
  messagesPerDay?: { date: string; count: number }[];
  isDashboardLoading?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  const windowMinutes = 60;
  const [distributionView, setDistributionView] = useState<"chart" | "list">("chart");

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  const previousRange = useMemo(() => {
    const duration = Math.max(0, endDate.getTime() - startDate.getTime());
    const to = new Date(startDate.getTime() - 1);
    const from = new Date(to.getTime() - duration);
    return { from, to };
  }, [endDate, startDate]);

  const previousStartISO = previousRange.from.toISOString();
  const previousEndISO = previousRange.to.toISOString();

  const { data, isLoading: isPeakLoading, isError } = useQuery({
    queryKey: ["group-peak-moment", groupId, startISO, endISO, windowMinutes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_peak_moment", {
        p_group_id: groupId,
        p_start: startISO,
        p_end: endISO,
        p_window_minutes: windowMinutes,
      });
      if (error) throw error;
      return (data as unknown as PeakMomentResponse | null) ?? null;
    },
    enabled: !!groupId && isAuthenticated,
    staleTime: 60_000,
  });

  const { data: previousData, isLoading: isPreviousLoading } = useQuery({
    queryKey: ["group-peak-moment-previous", groupId, previousStartISO, previousEndISO, windowMinutes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_peak_moment", {
        p_group_id: groupId,
        p_start: previousStartISO,
        p_end: previousEndISO,
        p_window_minutes: windowMinutes,
      });
      if (error) throw error;
      return (data as unknown as PeakMomentResponse | null) ?? null;
    },
    enabled: !!groupId && isAuthenticated,
    staleTime: 60_000,
  });

  const isLoading = isPeakLoading || !!isDashboardLoading;

  const noRelevantPeak = useMemo(() => {
    if (!data) return true;
    return (data.kpis?.total_messages ?? 0) === 0;
  }, [data]);

  const peakInterval = useMemo(() => {
    if (!data?.interval?.start_pico || !data?.interval?.end_pico) return null;
    return {
      start: new Date(data.interval.start_pico),
      end: new Date(data.interval.end_pico),
    };
  }, [data]);

  const previousPeakInterval = useMemo(() => {
    if (!previousData?.interval?.start_pico || !previousData?.interval?.end_pico) return null;
    return {
      start: new Date(previousData.interval.start_pico),
      end: new Date(previousData.interval.end_pico),
    };
  }, [previousData]);

  const peakHourRangeLabel = useMemo(() => {
    if (!peakInterval) return "";
    const start = peakInterval.start;
    const end = peakInterval.end;
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: SAO_PAULO_TZ,
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    const compact = (time: string) => {
      const [h, m] = time.split(":");
      if (!h || !m) return time;
      if (m === "00") return `${parseInt(h, 10)}h`;
      return `${h}:${m}`;
    };
    return `${compact(fmt(start))}–${compact(fmt(end))}`;
  }, [peakInterval]);

  const previousPeakHourRangeLabel = useMemo(() => {
    if (!previousPeakInterval) return "";
    const start = previousPeakInterval.start;
    const end = previousPeakInterval.end;
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: SAO_PAULO_TZ,
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    const compact = (time: string) => {
      const [h, m] = time.split(":");
      if (!h || !m) return time;
      if (m === "00") return `${parseInt(h, 10)}h`;
      return `${h}:${m}`;
    };
    return `${compact(fmt(start))}–${compact(fmt(end))}`;
  }, [previousPeakInterval]);

  const peakDateLabel = useMemo(() => {
    if (!peakInterval) return "";
    return formatDateSimpleBR(peakInterval.start);
  }, [peakInterval]);

  const peakDateTimeLabel = useMemo(() => {
    if (!peakInterval) return "";
    if (!peakHourRangeLabel) return peakDateLabel;
    return `${peakDateLabel} • ${peakHourRangeLabel}`;
  }, [peakDateLabel, peakHourRangeLabel, peakInterval]);

  const { data: peakMessagesByMinute, isLoading: isPeakDistributionLoading } = useQuery({
    queryKey: [
      "group-peak-moment-distribution",
      groupId,
      peakInterval?.start.toISOString(),
      peakInterval?.end.toISOString(),
      windowMinutes,
    ],
    queryFn: async () => {
      if (!peakInterval) return [] as { created_at: string }[];
      const { data, error } = await supabase
        .from("messages")
        .select("created_at")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .gte("created_at", peakInterval.start.toISOString())
        .lte("created_at", peakInterval.end.toISOString())
        .limit(10000);
      if (error) throw error;
      return ((data as unknown as { created_at: string }[]) || []).filter((r) => !!r.created_at);
    },
    enabled: !!groupId && isAuthenticated && !!peakInterval,
    staleTime: 60_000,
  });

  const distributionBuckets = useMemo(() => {
    if (!peakInterval) return [] as { label: string; count: number; start: Date; end: Date }[];
    const bucketMinutes = 5;
    const bucketCount = Math.max(1, Math.ceil(windowMinutes / bucketMinutes));
    const bucketMs = bucketMinutes * 60_000;
    const counts = Array.from({ length: bucketCount }, () => 0);

    for (const row of peakMessagesByMinute || []) {
      const ts = new Date(row.created_at).getTime();
      const idx = Math.floor((ts - peakInterval.start.getTime()) / bucketMs);
      if (idx >= 0 && idx < bucketCount) counts[idx] += 1;
    }

    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: SAO_PAULO_TZ,
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);

    return counts.map((count, idx) => {
      const start = new Date(peakInterval.start.getTime() + idx * bucketMs);
      const end = new Date(start.getTime() + bucketMs);
      const label = `${fmt(start)}–${fmt(end)}`;
      return { label, count, start, end };
    });
  }, [peakInterval, peakMessagesByMinute, windowMinutes]);

  const distributionMaxIndex = useMemo(() => {
    if (distributionBuckets.length === 0) return -1;
    let maxIdx = 0;
    for (let i = 1; i < distributionBuckets.length; i++) {
      if ((distributionBuckets[i]?.count || 0) > (distributionBuckets[maxIdx]?.count || 0)) maxIdx = i;
    }
    return maxIdx;
  }, [distributionBuckets]);

  const distributionTotal = useMemo(() => {
    return distributionBuckets.reduce((sum, b) => sum + (b.count || 0), 0);
  }, [distributionBuckets]);

  const topBuckets = useMemo(() => {
    return distributionBuckets
      .map((b, idx) => ({ ...b, idx }))
      .sort((a, b) => b.count - a.count || a.idx - b.idx)
      .slice(0, 5);
  }, [distributionBuckets]);

  const highlightTerms = useMemo(() => {
    return (data?.top_terms || [])
      .map((t) => (t.term || "").trim())
      .filter(Boolean)
      .slice(0, 10);
  }, [data]);

  const highlightRegex = useMemo(() => {
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const terms = (highlightTerms || []).slice().sort((a, b) => b.length - a.length);
    if (terms.length === 0) return null;
    return new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  }, [highlightTerms]);

  const renderHighlighted = (text: string) => {
    if (!text) return null;
    if (!highlightRegex) return text;
    const parts = text.split(highlightRegex);
    return parts.map((part, idx) => {
      const isMatch = idx % 2 === 1;
      if (!isMatch) return <span key={idx}>{part}</span>;
      return (
        <span key={idx} className="rounded-sm bg-amber-100/50 px-0.5 text-foreground/90">
          {part}
        </span>
      );
    });
  };

  const formatTimeSP = (dateStr: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_PAULO_TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div>
        <h3 className="text-base font-semibold text-card-foreground">Momento de pico</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Maior concentração de mensagens no período selecionado</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.5} aria-hidden="true" />
          <span className="tabular-nums">
            {peakDateLabel ? `${peakDateLabel} — ${peakHourRangeLabel || "—"}` : "—"}
          </span>
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-5">
            <Skeleton className="h-[110px] w-full rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Skeleton className="h-[80px] w-full rounded-xl" />
              <Skeleton className="h-[80px] w-full rounded-xl" />
              <Skeleton className="h-[80px] w-full rounded-xl" />
            </div>
            <Skeleton className="h-[240px] w-full rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-[220px] w-full rounded-xl" />
              <Skeleton className="h-[220px] w-full rounded-xl" />
            </div>
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm text-muted-foreground">Não foi possível carregar o Momento de pico.</p>
          </div>
        ) : noRelevantPeak ? (
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm text-muted-foreground">
              Sem pico relevante neste período. Ajuste o período para ver momentos mais movimentados.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Pico do período</p>
                  <p className="text-sm text-muted-foreground">{peakDateTimeLabel}</p>
                </div>
              </div>

              <p className="mt-3 text-xl sm:text-2xl font-semibold text-card-foreground">
                {(data?.kpis?.total_messages ?? 0).toLocaleString("pt-BR")} mensagens em {windowMinutes} min
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>Maior concentração do período analisado</span>
                <span className="text-muted-foreground/60">•</span>
                <span>vs período anterior:</span>
                {isPreviousLoading ? (
                  <Skeleton className="h-4 w-12" />
                ) : (
                  <DeltaLabel
                    current={data?.kpis?.total_messages ?? 0}
                    previous={previousData?.kpis?.total_messages ?? 0}
                    kind="percent"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-3 min-h-[84px] flex flex-col justify-between">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.5} />
                  <span>Horário mais ativo</span>
                </p>
                <div className="space-y-0.5">
                  <p className="text-lg font-semibold text-card-foreground tabular-nums">{peakHourRangeLabel || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    Antes: {previousPeakHourRangeLabel || "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 min-h-[84px] flex flex-col justify-between">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.5} />
                  <span>Participantes</span>
                </p>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-lg font-semibold text-card-foreground tabular-nums">
                    {(data?.kpis?.unique_participants ?? 0).toLocaleString("pt-BR")}
                  </p>
                  {isPreviousLoading ? (
                    <Skeleton className="h-4 w-12" />
                  ) : (
                    <DeltaLabel
                      current={data?.kpis?.unique_participants ?? 0}
                      previous={previousData?.kpis?.unique_participants ?? 0}
                      kind="percent"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 min-h-[84px] flex flex-col justify-between">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.5} />
                  <span>Intensidade</span>
                </p>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-lg font-semibold text-card-foreground tabular-nums">
                    {(data?.kpis?.intensity ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    <span className="text-sm font-medium text-muted-foreground"> msgs/h</span>
                  </p>
                  {isPreviousLoading ? (
                    <Skeleton className="h-4 w-12" />
                  ) : (
                    <DeltaLabel
                      current={data?.kpis?.intensity ?? 0}
                      previous={previousData?.kpis?.intensity ?? 0}
                      kind="percent"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">Dentro do pico</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Mensagens a cada 5 minutos</p>
                </div>
                <ToggleGroup
                  type="single"
                  value={distributionView}
                  onValueChange={(v) => {
                    if (!v) return;
                    setDistributionView(v as "chart" | "list");
                  }}
                  variant="outline"
                  size="sm"
                  aria-label="Alternar visualização de distribuição"
                  className="justify-start"
                >
                  <ToggleGroupItem value="chart" aria-label="Visualização em gráfico">
                    Gráfico
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="Visualização em lista">
                    Lista
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {isPeakDistributionLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : distributionBuckets.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center rounded-lg border border-border bg-secondary/30">
                  <p className="text-sm text-muted-foreground">Sem dados suficientes para detalhar o pico</p>
                </div>
              ) : distributionView === "chart" ? (
                <ChartContainer config={{ count: { label: "Mensagens" } }} className="h-[220px] w-full">
                  <BarChart data={distributionBuckets.map((b) => ({ label: b.label, count: b.count }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      {distributionBuckets.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill="hsl(var(--primary))"
                          fillOpacity={idx === distributionMaxIndex ? 1 : 0.25}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <ol className="divide-y divide-border">
                  {topBuckets.map((b, index) => {
                    const pct = distributionTotal > 0 ? (b.count / distributionTotal) * 100 : 0;
                    const highlight = b.idx === distributionMaxIndex;
                    return (
                      <li
                        key={b.label}
                        className={`py-2 flex items-center gap-3 ${highlight ? "bg-amber-50/40 rounded-md px-2" : ""}`}
                      >
                        <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
                        <span className="flex-1 min-w-0 text-sm text-card-foreground truncate">{b.label}</span>
                        <span className="shrink-0 text-sm text-card-foreground tabular-nums">
                          {b.count.toLocaleString("pt-BR")}
                        </span>
                        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-card-foreground mb-3">Principais participantes</p>
                {(data?.top_participants || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem participantes suficientes para destacar.</p>
                ) : (
                  <ol className="divide-y divide-border">
                    {(data?.top_participants || []).slice(0, 6).map((p, index) => (
                      <li key={`${p.sender_id || p.sender_name}`} className="py-2">
                        <div className="flex items-center gap-3">
                          <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
                          <span className="flex-1 min-w-0 text-sm font-medium text-card-foreground truncate">
                            {p.sender_name || "Desconhecido"}
                          </span>
                          <span className="w-20 shrink-0 text-right text-sm text-card-foreground tabular-nums">
                            {p.messages_count.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="pl-9 text-xs text-muted-foreground tabular-nums">
                          {p.percent_of_total.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-card-foreground mb-3">Principais termos</p>
                {(data?.top_terms || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ainda não há termos relevantes para este período.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(data?.top_terms || []).slice(0, 10).map((t) => (
                      <Badge
                        key={t.term}
                        variant="outline"
                        className="bg-muted/40 border-border px-2 py-0.5 text-[11px] font-medium text-foreground"
                      >
                        <span className="truncate max-w-[220px]">{t.term}</span>
                        <span className="ml-1.5 text-muted-foreground">· {t.frequency} msgs</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-amber-50/30 p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-card-foreground">Mensagens representativas</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Exemplos reais de mensagens que ajudam a entender o clima e os principais temas do grupo.
                </p>
              </div>

              {(data?.representative_messages || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem mensagens suficientes para destacar.</p>
              ) : (
                <div className="space-y-1.5 max-w-[760px] mx-auto">
                  {(data?.representative_messages || []).map((m) => {
                    const dateLabel = formatDateSimpleBR(new Date(m.created_at));
                    const timeLabel = formatTimeSP(m.created_at);
                    const isExpanded = expandedMessageId === m.message_id;
                    const preview = m.preview_text || "[Mensagem]";

                    return (
                      <div key={m.message_id} className="rounded-2xl border border-amber-100/70 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 text-[11px] text-muted-foreground">
                            <span className="font-medium text-muted-foreground truncate">{m.sender_name || "Desconhecido"}</span>
                            <span className="mx-1 text-muted-foreground/60">—</span>
                            <span className="text-muted-foreground/80">{dateLabel}</span>
                            <span className="mx-1 text-muted-foreground/60">—</span>
                            <span className="text-muted-foreground/60 tabular-nums">{timeLabel}</span>
                          </div>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Ver no contexto"
                                className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-amber-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMessageId(m.message_id);
                                }}
                              >
                                <Search className="h-4 w-4" strokeWidth={1.5} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" align="center">
                              Ver no contexto
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          className={`mt-1 w-full text-left text-sm text-foreground/80 whitespace-pre-wrap break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50/30 ${
                            isExpanded ? "" : "line-clamp-3"
                          }`}
                          onClick={() => setExpandedMessageId((prev) => (prev === m.message_id ? null : m.message_id))}
                        >
                          {renderHighlighted(preview)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!!data?.summary && (
                <div className="mt-3 rounded-lg border border-amber-100/70 bg-white/70 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Resumo</p>
                  <p className="mt-1 text-sm text-card-foreground whitespace-pre-wrap">{data.summary}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <MessageDetailsDrawer
        open={!!selectedMessageId}
        onOpenChange={(open) => {
          if (!open) setSelectedMessageId(null);
        }}
        groupId={groupId}
        messageId={selectedMessageId as string}
        variant="sheet"
      />
    </section>
  );
}
