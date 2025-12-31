import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateSimpleBR, formatDateTimeBR, SAO_PAULO_TZ } from "@/lib/date";
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

  const peakDateTimeLabel = useMemo(() => {
    if (!peakInterval) return "";
    if (!peakHourRangeLabel) return peakDateLabel;
    return `${peakDateLabel} • ${peakHourRangeLabel}`;
  }, [peakDateLabel, peakHourRangeLabel, peakInterval]);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      {isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-[120px] w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-[76px] w-full rounded-xl" />
            <Skeleton className="h-[76px] w-full rounded-xl" />
            <Skeleton className="h-[76px] w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
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
        <div className="space-y-5">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 sm:p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-card-foreground">Momento de pico</p>
              <p className="text-sm text-muted-foreground">{peakDateTimeLabel}</p>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-semibold text-card-foreground">
              Pico: {(data?.kpis?.total_messages ?? 0).toLocaleString("pt-BR")} mensagens em 1 hora
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Maior concentração do período analisado</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 h-[76px] flex flex-col justify-between">
              <p className="text-xs font-medium text-muted-foreground">🕒 Horário mais ativo</p>
              <p className="text-lg font-semibold text-card-foreground tabular-nums">{peakHourRangeLabel || "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 h-[76px] flex flex-col justify-between">
              <p className="text-xs font-medium text-muted-foreground">👥 Participantes</p>
              <p className="text-lg font-semibold text-card-foreground tabular-nums">
                {(data?.kpis?.unique_participants ?? 0).toLocaleString("pt-BR")} membros
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 h-[76px] flex flex-col justify-between">
              <p className="text-xs font-medium text-muted-foreground">📈 Intensidade</p>
              <p className="text-lg font-semibold text-card-foreground tabular-nums">
                {(data?.kpis?.intensity ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} msgs/h
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-semibold text-card-foreground">Principais participantes</p>
              {(data?.top_participants || []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Sem participantes suficientes para destacar.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {(data?.top_participants || []).slice(0, 6).map((p) => (
                    <div key={`${p.sender_id || p.sender_name}`} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{p.sender_name || "Desconhecido"}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        <span>{p.messages_count.toLocaleString("pt-BR")} msgs</span>
                        <span>{p.percent_of_total.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-semibold text-card-foreground">Principais termos</p>
              {(data?.top_terms || []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Sem termos suficientes para destacar.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data?.top_terms?.slice(0, 14).map((t) => (
                    <Badge key={t.term} variant="secondary" className="text-xs">
                      {t.term}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm font-semibold text-card-foreground">Mensagens representativas</p>
            {(data?.representative_messages || []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Sem mensagens suficientes para destacar.</p>
            ) : (
              <div className="mt-3 rounded-lg border border-border bg-card divide-y divide-border">
                {(data?.representative_messages || []).map((m) => (
                  <div key={m.message_id} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        <span className="text-card-foreground">{m.sender_name || "Desconhecido"}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDateTimeBR(m.created_at)}</span>
                      </p>
                      <p className="mt-1 text-sm text-card-foreground whitespace-pre-wrap break-words">{m.preview_text || "[Mensagem]"}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setSelectedMessageId(m.message_id)}
                    >
                      Ver no contexto →
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!!data?.summary && (
              <div className="mt-4 rounded-lg border border-border bg-background/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Resumo</p>
                <p className="mt-1 text-sm text-card-foreground whitespace-pre-wrap">{data.summary}</p>
              </div>
            )}
          </div>
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
