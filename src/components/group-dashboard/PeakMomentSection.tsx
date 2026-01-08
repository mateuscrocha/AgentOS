import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MetricHelp } from "@/components/ui/metric-help";
import { formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";
import { MessageDetailsDrawer } from "@/components/messages/MessageDetailsDrawer";
import { useNavigate } from "react-router-dom";

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
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const navigate = useNavigate();

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

  const keyMessages = useMemo(() => {
    const items = (data?.representative_messages || [])
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (items.length <= 3) return items;
    const first = items[0];
    const last = items[items.length - 1];
    const middle = items[Math.floor(items.length / 2)];
    return [first, middle, last];
  }, [data]);

  const unfoldText = useMemo(() => {
    const uniqueParticipants = data?.kpis?.unique_participants ?? 0;

    const previews = keyMessages.map((m) => (m.preview_text || "").trim()).filter(Boolean);
    const questions = previews.reduce((acc, t) => acc + (t.match(/\?/g)?.length ?? 0), 0);
    const exclamations = previews.reduce((acc, t) => acc + (t.match(/!/g)?.length ?? 0), 0);

    const firstPreview = (keyMessages[0]?.preview_text || "").trim();
    const hasLink = /https?:\/\//i.test(firstPreview);
    const isLong = firstPreview.length >= 110;

    if (keyMessages.length === 0) {
      return "Uma troca rápida puxou mensagens em sequência.";
    }

    if (keyMessages.length === 1) {
      if (hasLink) return "Um link compartilhado puxou comentários em sequência.";
      if (questions > 0) return "Uma pergunta puxou respostas em sequência.";
      if (exclamations > 0) return "Uma novidade puxou reações rápidas.";
      if (isLong) return "Uma explicação mais longa puxou respostas em sequência.";
      return "Um recado puxou respostas em sequência.";
    }

    if (hasLink) return "Um link compartilhado virou uma troca em sequência.";
    if (questions > exclamations) return "Uma pergunta abriu espaço para respostas em sequência.";
    if (exclamations > questions) return "Uma novidade puxou reações rápidas.";
    if (uniqueParticipants >= 6) return "Um tópico engajou várias pessoas e virou uma troca em sequência.";
    if (isLong) return "Uma explicação mais longa puxou respostas em sequência.";
    return "Um recado puxou respostas em sequência.";
  }, [data, keyMessages]);

  const MessageBubble = ({
    messageId,
    sender,
    timeLabel,
    preview,
  }: {
    messageId: string;
    sender: string;
    timeLabel: string;
    preview: string;
  }) => {
    return (
      <div className="flex w-full justify-start">
        <div className="relative w-full rounded-2xl rounded-tl-md border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-left shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/25">
          <span
            aria-hidden="true"
            className="absolute left-0 top-4 -translate-x-1/2 h-3 w-3 rotate-45 border-l border-t border-emerald-200/70 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/25"
          />

          <div className="min-w-0 truncate text-xs font-semibold text-emerald-900 dark:text-emerald-200">
            {sender}
          </div>

          <div className="mt-1.5 pt-0.5 text-sm text-foreground/90 leading-relaxed line-clamp-4 whitespace-pre-wrap break-words">
            {preview}
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="text-[11px] text-muted-foreground tabular-nums">{timeLabel}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Ver no contexto"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/80 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSelectedMessageId(messageId)}
                >
                  <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" align="center">
                Ver no contexto
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  };

  const formatTimeSP = (dateStr: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_PAULO_TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));

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

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-card-foreground">Como a conversa se desenrolou</p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{unfoldText}</p>

              {keyMessages.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {keyMessages.map((m) => {
                    const timeLabel = formatTimeSP(m.created_at);
                    const sender = m.sender_name || "Desconhecido";
                    const preview = (m.preview_text || "").trim() || "[Mensagem]";

                    return (
                      <MessageBubble
                        key={m.message_id}
                        messageId={m.message_id}
                        sender={sender}
                        timeLabel={timeLabel}
                        preview={preview}
                      />
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-4 border-t border-border pt-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    if (!peakInterval) return;
                    const sp = new URLSearchParams({
                      from: peakInterval.start.toISOString(),
                      to: peakInterval.end.toISOString(),
                    });
                    navigate(`/groups/${groupId}/messages?${sp.toString()}`);
                  }}
                >
                  Ver mais mensagens desse momento
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
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
