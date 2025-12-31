import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";
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

  const highlightTerms = useMemo(() => {
    return (data?.top_terms || [])
      .map((t) => (t.term || "").trim())
      .filter(Boolean)
      .slice(0, 6);
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
        <span key={idx} className="rounded-sm bg-secondary/70 px-0.5 text-foreground/90">
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
        <p className="text-xs text-muted-foreground">Maior concentração de mensagens no período analisado</p>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-5">
            <Skeleton className="h-[86px] w-full rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Skeleton className="h-[220px] w-full rounded-xl lg:col-span-5" />
              <Skeleton className="h-[220px] w-full rounded-xl lg:col-span-7" />
            </div>
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
              <p className="text-xs font-medium text-muted-foreground">Pico</p>
              <p className="mt-1 text-xl sm:text-2xl font-semibold text-card-foreground tabular-nums">
                Pico: {(data?.kpis?.total_messages ?? 0).toLocaleString("pt-BR")} mensagens em 1 hora
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 lg:col-span-5">
                <p className="text-sm font-semibold text-card-foreground">Principais temas do pico</p>

                {(data?.top_terms || []).length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Ainda não há temas suficientes para destacar.</p>
                ) : (
                  <ul className="mt-3 space-y-1">
                    {(data?.top_terms || []).slice(0, 6).map((t) => (
                      <li key={t.term} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate text-sm text-card-foreground">{t.term}</span>
                        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">— {t.frequency.toLocaleString("pt-BR")} menções</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4 lg:col-span-7">
                <p className="text-sm font-semibold text-card-foreground">Mensagens representativas</p>

                {(data?.representative_messages || []).length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Sem mensagens suficientes para destacar.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {(data?.representative_messages || []).slice(0, 5).map((m) => {
                      const timeLabel = formatTimeSP(m.created_at);
                      const sender = m.sender_name || "Desconhecido";
                      const preview = (m.preview_text || "").trim() || "[Mensagem]";

                      return (
                        <li key={m.message_id} className="rounded-2xl border border-border bg-secondary/20 px-3 py-2">
                          <div className="flex items-start gap-3">
                            <span className="w-12 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
                              {timeLabel}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 flex-1 truncate text-xs font-medium text-card-foreground">
                                  {sender}
                                </span>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="Ver no contexto"
                                      className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      onClick={() => setSelectedMessageId(m.message_id)}
                                    >
                                      <Search className="h-4 w-4" strokeWidth={1.5} />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" align="center">
                                    Ver no contexto
                                  </TooltipContent>
                                </Tooltip>
                              </div>

                              <div className="mt-0.5 text-sm text-foreground/80 line-clamp-2 whitespace-pre-wrap break-words">
                                {renderHighlighted(preview)}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
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
