import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricHelp } from "@/components/ui/metric-help";
import { formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";

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
  top_participants?: Array<{
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

  const windowMinutes = 60;

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

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

  const peakDateLabel = useMemo(() => {
    if (!peakInterval) return "";
    return formatDateSimpleBR(peakInterval.start);
  }, [peakInterval]);

  const peakWeekdayLabel = useMemo(() => {
    if (!peakInterval) return "";
    const weekday = new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_PAULO_TZ,
      weekday: "long",
    }).format(peakInterval.start);
    return weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : "";
  }, [peakInterval]);

  const intensityRead = useMemo(() => {
    const peakTotal = data?.kpis?.total_messages ?? 0;
    const uniqueParticipants = data?.kpis?.unique_participants ?? 0;

    const counts = (messagesPerDay || [])
      .map((d) => Number(d.count) || 0)
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    const medianPerDay = (() => {
      if (counts.length === 0) return null;
      const mid = Math.floor(counts.length / 2);
      if (counts.length % 2 === 0) return (counts[mid - 1] + counts[mid]) / 2;
      return counts[mid];
    })();

    const typicalPerHour = medianPerDay ? (medianPerDay / 24) * (windowMinutes / 60) : null;
    const safeTypical = typicalPerHour && typicalPerHour > 0 ? Math.max(0.75, typicalPerHour) : null;
    const ratio = safeTypical ? peakTotal / safeTypical : null;

    const intensityLabel = (() => {
      if (!ratio) return "Acima do normal para o grupo";
      if (ratio >= 3) return "Muito acima do ritmo típico do grupo";
      if (ratio >= 1.8) return "Acima do ritmo típico do grupo";
      if (ratio >= 1.2) return "Levemente acima do ritmo típico do grupo";
      return "Próximo do ritmo típico do grupo";
    })();

    const participantsRead = (() => {
      if (uniqueParticipants <= 0) return "";
      if (uniqueParticipants === 1) return "Concentrado em 1 pessoa";
      return `${uniqueParticipants.toLocaleString("pt-BR")} participantes`;
    })();

    const ratioRead = ratio ? `${ratio.toFixed(1).replace(".", ",")}×` : null;
    const support = (() => {
      if (ratioRead && participantsRead) return `${intensityLabel} (${ratioRead}) · ${participantsRead}`;
      if (participantsRead) return `${intensityLabel} · ${participantsRead}`;
      return intensityLabel;
    })();

    return {
      peakTotal,
      support,
      ratio,
      uniqueParticipants,
    };
  }, [data, messagesPerDay, windowMinutes]);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-card-foreground">Momento de Pico</h3>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.5} aria-hidden="true" />
          {peakInterval ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground/80">{peakWeekdayLabel},</span>{" "}
              <span className="tabular-nums">{peakDateLabel} • {peakHourRangeLabel || "—"}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Maior atividade do grupo no período analisado</p>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-5">
            <Skeleton className="h-[86px] w-full rounded-xl" />
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
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Intensidade</p>
                <MetricHelp
                  metricTitle="Intensidade"
                  whatIs="Quantas mensagens aconteceram no momento mais movimentado do período (em 1 hora)."
                  howToInterpret="Ajuda a entender quando a conversa acelera: picos concentrados costumam aparecer quando um tema engaja várias pessoas ao mesmo tempo."
                  whatToObserve="Se o pico vem com poucos participantes, a conversa pode estar concentrada em poucas pessoas."
                />
              </div>
              <p className="mt-1 text-xl sm:text-2xl font-semibold text-card-foreground tabular-nums">
                {intensityRead.peakTotal.toLocaleString("pt-BR")} mensagens em 1 hora
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{intensityRead.support}</p>
            </div>

          </div>
        )}
      </div>
    </section>
  );
}
