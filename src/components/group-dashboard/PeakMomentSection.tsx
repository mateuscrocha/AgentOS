import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, Clock, MessageSquareText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SectionHeader } from "./SectionHeader";
import { KpiCard } from "./KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTickBR, formatDateTimeBR, SAO_PAULO_TZ } from "@/lib/date";
import { MessageDetailsDrawer } from "@/components/messages/MessageDetailsDrawer";

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
  messagesPerDay = [],
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

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  const { data, isLoading: isPeakLoading, isError } = useQuery({
    queryKey: ["group-peak-moment", groupId, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_peak_moment", {
        p_group_id: groupId,
        p_start: startISO,
        p_end: endISO,
        p_window_minutes: 60,
      });
      if (error) throw error;
      return (data as unknown as PeakMomentResponse | null) ?? null;
    },
    enabled: !!groupId && isAuthenticated,
    staleTime: 60_000,
  });

  const isLoading = isPeakLoading || !!isDashboardLoading;

  const mostActiveDay = useMemo(() => {
    if (!messagesPerDay || messagesPerDay.length === 0) return null;
    const counts: Record<string, number> = {};
    messagesPerDay.forEach((d) => {
      const day = new Date(d.date).toLocaleDateString("pt-BR", { weekday: "long", timeZone: SAO_PAULO_TZ });
      counts[day] = (counts[day] || 0) + d.count;
    });
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    const [day, count] = entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max));
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    return { day: dayLabel, count };
  }, [messagesPerDay]);

  const noRelevantPeak = useMemo(() => {
    if (!data) return true;
    return (data.kpis?.total_messages ?? 0) === 0;
  }, [data]);

  const intervalLabel = useMemo(() => {
    if (!data?.interval?.start_pico || !data?.interval?.end_pico) return "";
    const start = new Date(data.interval.start_pico);
    const end = new Date(data.interval.end_pico);
    const dateLabel = formatDateTickBR(start);
    const startTime = new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_PAULO_TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(start);
    const endTime = new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_PAULO_TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(end);
    return `${dateLabel}, ${startTime} às ${endTime}`;
  }, [data]);

  const peakHourRangeLabel = useMemo(() => {
    if (!data?.interval?.start_pico || !data?.interval?.end_pico) return "";
    const start = new Date(data.interval.start_pico);
    const end = new Date(data.interval.end_pico);
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
  }, [data]);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Momento de pico"
        subtitle="Maior concentração de mensagens no período selecionado"
        helpText="Encontra a janela de 1h com mais mensagens no período e resume participantes, termos e mensagens representativas."
      />

      {isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Skeleton className="h-[92px] w-full rounded-xl" />
            <Skeleton className="h-[92px] w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-[92px] w-full rounded-xl" />
            <Skeleton className="h-[92px] w-full rounded-xl" />
            <Skeleton className="h-[92px] w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm text-muted-foreground">Não foi possível carregar o Momento de pico.</p>
        </div>
      ) : noRelevantPeak ? (
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm text-muted-foreground">
            Sem pico relevante neste período. Ajuste o filtro de datas para ver momentos mais movimentados.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-xs text-muted-foreground">{intervalLabel}</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <KpiCard
              title="Horário de maior atividade"
              value={peakHourRangeLabel || "—"}
              subtitle={`${(data?.kpis?.total_messages ?? 0).toLocaleString("pt-BR")} msgs`}
              icon={Clock}
            />
            <KpiCard
              title="Dia mais movimentado"
              value={mostActiveDay?.day || "—"}
              subtitle={mostActiveDay ? `${mostActiveDay.count.toLocaleString("pt-BR")} msgs` : "Sem dados"}
              icon={CalendarDays}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard
              title="Mensagens no pico"
              value={(data?.kpis?.total_messages ?? 0).toLocaleString("pt-BR")}
              icon={MessageSquareText}
            />
            <KpiCard
              title="Participantes"
              value={(data?.kpis?.unique_participants ?? 0).toLocaleString("pt-BR")}
              icon={Users}
            />
            <KpiCard
              title="Intensidade"
              value={`${(data?.kpis?.intensity ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`}
              subtitle="msgs/h"
              icon={Activity}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-semibold text-card-foreground">Principais participantes</p>
              <div className="mt-3 space-y-2">
                {(data?.top_participants || []).map((p) => (
                  <div key={`${p.sender_id || p.sender_name}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-card-foreground truncate">{p.sender_name || "Desconhecido"}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.messages_count.toLocaleString("pt-BR")} msgs • {p.percent_of_total.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-semibold text-card-foreground">Principais termos</p>
              {(data?.top_terms || []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Sem termos suficientes para destacar.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data?.top_terms?.map((t) => (
                    <Badge key={t.term} variant="secondary" className="text-xs">
                      {t.term}
                      <span className="ml-1 text-muted-foreground">{t.frequency}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm font-semibold text-card-foreground">Mensagens representativas</p>
            <div className="mt-3 space-y-3">
              {(data?.representative_messages || []).map((m) => (
                <div key={m.message_id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        <span className="text-card-foreground">{m.sender_name || "Desconhecido"}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDateTimeBR(m.created_at)}</span>
                      </div>
                      <div className="mt-1 text-sm text-card-foreground whitespace-pre-wrap break-words">{m.preview_text || "[Mensagem]"}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setSelectedMessageId(m.message_id)}
                    >
                      Ver no contexto
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!!data?.summary && (
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-semibold text-card-foreground">Resumo do pico</p>
              <p className="mt-2 text-sm text-card-foreground whitespace-pre-wrap">{data.summary}</p>
            </div>
          )}
        </div>
      )}

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
