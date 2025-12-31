import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateSimpleBR, formatDateTimeBR, SAO_PAULO_TZ } from "@/lib/date";
import { MessageDetailsDrawer } from "@/components/messages/MessageDetailsDrawer";

type MessageForTerms = {
  id: string;
  content: string | null;
  member_id: string | null;
  sender_phone: string | null;
};

type TermStat = {
  term: string;
  messagesCount: number;
  participantsCount: number;
  score: number;
};

const STOPWORDS_PT = new Set([
  "a","à","às","ao","aos","ainda","alem","algum","alguma","alguns","algumas","antes","apos","as","ate",
  "cada","coisa","coisas","como","da","das","de","dela","dele","deles","demais","depois","desde","dessa","desse","desta","deste","do","dos",
  "e","ela","ele","eles","elas","em","entre","era","eram","essa","esse","esta","este","eu","faz","fazer","feito","foi","fora","houve","isso","isto",
  "ja","la","lhe","lhes","logo","mais","maior","me","mesmo","meu","meus","minha","minhas","muito","muita","muitos","muitas",
  "na","nas","nao","nem","no","nos","nossa","nossas","nosso","nossos","nunca",
  "o","os","ou","para","pela","pelas","pelo","pelos","per","pode","por","porque","pra",
  "quais","qual","quando","que","quem","se","sem","ser","seu","seus","sua","suas","sobre","so","sao",
  "tambem","tanto","te","tem","tenho","tendo","ter","tinha","tiveram","tivemos","tive","todo","toda","todos","todas",
  "um","uma","uns","umas","vai","vao","voce","voces","vos","vou",
  "ai","tipo","cara","mano","pessoal","galera","gente","ok","blz","vlw","obrigado","obrigada","bom","boa","dia","noite","tarde",
  "kkk","rs","haha","hahaha","eh","ta","to","tamo","tb",
]);

const TLD_RE = /\.(com|com\.br|br|net|io|org|gov|edu|app|dev|me|co|info|biz|tv|gg|ly)(\b|\/)/i;

const normalizeBasic = (s: string): string =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isOnlySpecial = (s: string): boolean => {
  const cleaned = (s || "").replace(/[\p{L}\p{N}]/gu, "");
  return cleaned.length > 0 && cleaned.length === (s || "").length;
};

const hasTooManyNumbers = (token: string): boolean => {
  const t = token || "";
  const digits = (t.match(/\d/g) || []).length;
  if (digits === 0) return false;
  const letters = (t.match(/[a-z]/g) || []).length;
  if (letters === 0) return true;
  const total = digits + letters;
  return digits >= 3 || digits / Math.max(1, total) > 0.4;
};

const shouldDropRawToken = (raw: string): boolean => {
  const r = raw || "";
  const n = normalizeBasic(r);
  if (!n) return true;
  if (n.includes("http") || n.includes("www")) return true;
  if (TLD_RE.test(r)) return true;
  if (r.length > 40) return true;
  if (isOnlySpecial(r)) return true;
  return false;
};

const shouldDropToken = (token: string): boolean => {
  const t = token || "";
  if (!t) return true;
  if (t.length < 3) return true;
  if (t.length > 40) return true;
  if (t.includes("http") || t.includes("www")) return true;
  if (STOPWORDS_PT.has(t)) return true;
  if (hasTooManyNumbers(t)) return true;
  if (/^[0-9]+$/.test(t)) return true;
  return false;
};

const tokenizeClean = (text: string): string[] => {
  const cleaned = (text || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/www\.[^\s]+/gi, " ");

  const whitespaceParts = cleaned.split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (const part of whitespaceParts) {
    if (shouldDropRawToken(part)) continue;
    const subParts = part.replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(Boolean);
    for (const sp of subParts) {
      const norm = normalizeBasic(sp).replace(/[^\p{L}\p{N}]+/gu, "");
      if (shouldDropToken(norm)) continue;
      tokens.push(norm);
    }
  }
  return tokens;
};

const ngrams = (tokens: string[], size: 2 | 3): string[] => {
  if (!tokens || tokens.length < size) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - size; i++) {
    const slice = tokens.slice(i, i + size);
    if (slice.some((t) => shouldDropToken(t))) continue;
    out.push(slice.join(" "));
  }
  return out;
};

const getThresholds = (totalMessages: number, totalParticipants: number) => {
  const x = totalMessages < 150 ? 2 : totalMessages < 500 ? 3 : totalMessages < 1200 ? 4 : 6;
  const y = totalParticipants < 10 ? 2 : totalParticipants < 30 ? 3 : 4;
  return { minMessages: x, minParticipants: Math.max(1, Math.min(y, totalParticipants)) };
};

const extractRelevantTerms = (rows: MessageForTerms[]): TermStat[] => {
  const messages = rows || [];
  if (messages.length === 0) return [];

  const termToMessages = new Map<string, Set<string>>();
  const termToParticipants = new Map<string, Set<string>>();
  const unigramToMessages = new Map<string, Set<string>>();
  const unigramToParticipants = new Map<string, Set<string>>();
  const allParticipants = new Set<string>();

  for (const m of messages) {
    const participantKey = (m.member_id || m.sender_phone || "").toString();
    if (participantKey) allParticipants.add(participantKey);

    const tokens = tokenizeClean(m.content || "");
    if (tokens.length === 0) continue;
    const msgId = m.id;
    const localTerms = new Set<string>();

    const localTokens = new Set(tokens);
    for (const t of localTokens) {
      if (!unigramToMessages.has(t)) unigramToMessages.set(t, new Set());
      unigramToMessages.get(t)!.add(msgId);
      if (participantKey) {
        if (!unigramToParticipants.has(t)) unigramToParticipants.set(t, new Set());
        unigramToParticipants.get(t)!.add(participantKey);
      }
    }

    [...ngrams(tokens, 2), ...ngrams(tokens, 3)].forEach((term) => localTerms.add(term));

    for (const term of localTerms) {
      if (!termToMessages.has(term)) termToMessages.set(term, new Set());
      termToMessages.get(term)!.add(msgId);
      if (participantKey) {
        if (!termToParticipants.has(term)) termToParticipants.set(term, new Set());
        termToParticipants.get(term)!.add(participantKey);
      }
    }
  }

  const { minMessages, minParticipants } = getThresholds(messages.length, allParticipants.size);
  const scored = Array.from(termToMessages.entries())
    .map(([term, msgSet]) => {
      const messagesCount = msgSet.size;
      const participantsCount = (termToParticipants.get(term)?.size || 0);
      const score = messagesCount * participantsCount;
      return { term, messagesCount, participantsCount, score };
    })
    .filter((t) => t.messagesCount >= minMessages)
    .filter((t) => t.participantsCount >= minParticipants)
    .sort((a, b) => b.score - a.score || b.messagesCount - a.messagesCount || b.participantsCount - a.participantsCount || a.term.localeCompare(b.term));

  const top = scored.slice(0, 10);
  if (top.length >= 5) return top;

  const fallback = Array.from(unigramToMessages.entries())
    .map(([term, msgSet]) => {
      const messagesCount = msgSet.size;
      const participantsCount = (unigramToParticipants.get(term)?.size || 0);
      const score = messagesCount * participantsCount;
      return { term, messagesCount, participantsCount, score };
    })
    .filter((t) => t.messagesCount >= minMessages)
    .filter((t) => t.participantsCount >= minParticipants)
    .sort((a, b) => b.score - a.score || b.messagesCount - a.messagesCount || b.participantsCount - a.participantsCount || a.term.localeCompare(b.term));

  const merged = new Map<string, TermStat>();
  [...top, ...fallback].forEach((t) => {
    if (!merged.has(t.term)) merged.set(t.term, t);
  });
  return Array.from(merged.values()).slice(0, 10);
};

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

  const { data: periodMessagesForTerms } = useQuery({
    queryKey: ["group-peak-terms-messages", groupId, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, member_id, sender_phone")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .eq("message_type", "text")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .limit(2000);
      if (error) throw error;
      return (data as unknown as MessageForTerms[]) || [];
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

  const relevantTerms = useMemo(() => {
    return extractRelevantTerms(periodMessagesForTerms || []);
  }, [periodMessagesForTerms]);

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
              {relevantTerms.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Ainda não há termos relevantes para este período.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {relevantTerms.slice(0, 10).map((t) => (
                    <Badge key={t.term} variant="secondary" className="text-xs">
                      <span className="truncate max-w-[220px]">{t.term}</span>
                      <span className="ml-1.5 text-muted-foreground">· {t.messagesCount} msgs</span>
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
