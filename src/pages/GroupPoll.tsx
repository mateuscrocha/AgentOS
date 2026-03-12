import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, NavLink } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import AccessDenied from "./AccessDenied";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Activity, Check, Copy, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { KpiCard } from "@/components/group-dashboard";
import { formatDateDescriptiveBR, formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";
import { computePollPercent, normalizeVotedOptions } from "@/lib/polls";
import { notify } from "@/components/ui/sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getInitialsFromName } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type PollRow = Database["public"]["Tables"]["polls"]["Row"];
type PollSummaryRow = Database["public"]["Views"]["v_poll_summary"]["Row"];
type PollResultsRow = Database["public"]["Views"]["v_poll_results"]["Row"];
type PollVotesByPersonRow = Database["public"]["Views"]["v_poll_votes_by_person"]["Row"];
type PollIngestionAuditRow = Database["public"]["Views"]["v_poll_ingestion_audit"]["Row"];

type PollVoteByPersonItem = {
  personId: string | null;
  personName: string | null;
  votedOptions: string[];
  createdAt: string;
  voteSequence: number | null;
  votesCount: number | null;
};

type PollOptionItem = {
  optionText: string;
  optionIndex: number;
  votesCount: number;
};

export default function GroupPoll() {
  const { groupId, pollId } = useParams();
  const queryClient = useQueryClient();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [copyFallbackOpen, setCopyFallbackOpen] = useState(false);
  const [copyFallbackText, setCopyFallbackText] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);
  const loggedAvatarFailuresRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const makeShortTitle = (text: string, max = 60) => {
    const raw = (text ?? "").toString().trim();
    if (!raw) return "Enquete";
    if (raw.length <= max) return raw;
    return `${raw.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
  };

  const openCopyFallback = (text: string) => {
    setCopyFallbackText(text);
    setCopyFallbackOpen(true);
    queueMicrotask(() => {
      copyTextareaRef.current?.focus();
      copyTextareaRef.current?.select();
    });
  };

  const { data: groupInfo } = useQuery({
    queryKey: ["group-info", groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from("groups")
        .select("name, organization_id")
        .eq("id", groupId)
        .maybeSingle();
      if (!group) return null;
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", group.organization_id)
        .maybeSingle();
      return { groupName: group.name, orgName: org?.name, orgId: group.organization_id };
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: totalMembersCount } = useQuery({
    queryKey: ["group-members-total", groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId)
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: poll, error: pollError, isLoading: pollLoading } = useQuery({
    queryKey: ["poll", pollId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polls")
        .select("id, question, max_options, created_at")
        .eq("id", pollId)
        .maybeSingle();
      if (error) throw error;
      return data as Pick<PollRow, "id" | "question" | "max_options" | "created_at"> | null;
    },
    enabled: !!pollId && isAuthenticated,
  });

  const { data: pollOptions, error: pollOptionsError } = useQuery({
    queryKey: ["poll-options-results", pollId],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_poll_results")
        .select("option_text, option_index, votes_count")
        .eq("poll_id", pollId)
        .order("option_index", { ascending: true });

      return ((data ?? []) as PollResultsRow[]).map((r): PollOptionItem => ({
        optionText: String(r.option_text ?? "").trim() || "—",
        optionIndex: Number(r.option_index ?? 0),
        votesCount: Number(r.votes_count ?? 0),
      }));
    },
    enabled: !!pollId && isAuthenticated,
  });

  const { data: pollSummary, error: pollSummaryError } = useQuery({
    queryKey: ["poll-summary", pollId],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_poll_summary")
        .select("voters_count, vote_events_count, selections_count")
        .eq("poll_id", pollId)
        .maybeSingle();
      return data as Pick<PollSummaryRow, "voters_count" | "vote_events_count" | "selections_count"> | null;
    },
    enabled: !!pollId && isAuthenticated,
  });

  const { data: pollVotesByPerson, isLoading: pollVotesByPersonLoading, error: pollVotesByPersonError } = useQuery({
    queryKey: ["poll-votes-by-person", pollId],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_poll_votes_by_person")
        .select("person_id, person_name, voted_options, created_at, vote_sequence, votes_count")
        .eq("poll_id", pollId)
        .order("created_at", { ascending: false });

      return ((data ?? []) as PollVotesByPersonRow[]).map((r): PollVoteByPersonItem => ({
        personId: (r.person_id as string | null) ?? null,
        personName: (r.person_name as string | null) ?? null,
        votedOptions: normalizeVotedOptions(r.voted_options),
        createdAt: (r.created_at as string | null) ?? "",
        voteSequence: Number(r.vote_sequence ?? 0) || null,
        votesCount: Number(r.votes_count ?? 0) || null,
      }));
    },
    enabled: !!pollId && isAuthenticated,
  });

  const { data: pollAudit, error: pollAuditError } = useQuery({
    queryKey: ["poll-ingestion-audit", pollId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_poll_ingestion_audit")
        .select("is_multiselect_with_possible_legacy_truncation, is_missing_vote_message_ids_for_all_rows, is_missing_raw_payload_for_all_rows, total_vote_rows, voters_at_two_or_more_events")
        .eq("poll_id", pollId)
        .maybeSingle();
      if (error) throw error;
      return data as Pick<
        PollIngestionAuditRow,
        | "is_multiselect_with_possible_legacy_truncation"
        | "is_missing_vote_message_ids_for_all_rows"
        | "is_missing_raw_payload_for_all_rows"
        | "total_vote_rows"
        | "voters_at_two_or_more_events"
      > | null;
    },
    enabled: !!pollId && isAuthenticated,
  });

  const voterIds = useMemo(() => {
    const ids = (pollVotesByPerson ?? [])
      .map((v) => v.personId)
      .filter((id): id is string => !!id);
    return Array.from(new Set(ids)).sort();
  }, [pollVotesByPerson]);

  const { data: voterAvatarMap, error: voterAvatarError } = useQuery({
    queryKey: ["poll-voters-avatars", groupId, voterIds],
    queryFn: async () => {
      if (!voterIds.length || !groupId) return {} as Record<string, string | null>;
      const { data, error } = await supabase
        .from("members")
        .select("id, profile_pic_url")
        .eq("group_id", groupId)
        .in("id", voterIds);
      if (error) throw error;
      const map: Record<string, string | null> = {};
      for (const row of data ?? []) {
        map[String(row.id)] = (row.profile_pic_url as string | null) ?? null;
      }
      return map;
    },
    enabled: !!groupId && voterIds.length > 0 && isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const detailError = pollOptionsError || pollSummaryError || pollVotesByPersonError || voterAvatarError || pollAuditError;

  if (authLoading) {
    return (
      <AdminLayout title="Enquete" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  const pollErrorMessage = pollError instanceof Error ? pollError.message : "";
  const pollErrorCode = (() => {
    if (!pollError || typeof pollError !== "object") return "";
    if (!("code" in pollError)) return "";
    return String((pollError as { code?: unknown }).code ?? "");
  })();

  if (pollError && (pollErrorMessage.includes("permission") || pollErrorCode === "PGRST301")) {
    return <AccessDenied message="Você não tem permissão para acessar esta enquete." />;
  }

  if (pollError || detailError) {
    return (
      <AdminLayout title="Enquete" subtitle="Detalhes da enquete">
        <ErrorState
          title="Não foi possível carregar a enquete."
          message="Tente novamente em instantes."
          retry={() => {
            queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
            queryClient.invalidateQueries({ queryKey: ["poll-options-results", pollId] });
            queryClient.invalidateQueries({ queryKey: ["poll-summary", pollId] });
            queryClient.invalidateQueries({ queryKey: ["poll-votes-by-person", pollId] });
            queryClient.invalidateQueries({ queryKey: ["poll-voters-avatars"] });
          }}
        />
      </AdminLayout>
    );
  }

  const totalVotes = (pollOptions ?? []).reduce((sum, o) => sum + o.votesCount, 0);
  const votersCount = Number(pollSummary?.voters_count ?? 0);
  const voteEventsCount = Number(pollSummary?.vote_events_count ?? 0);
  const selectionsCount = Number(pollSummary?.selections_count ?? 0);
  const percentBase = selectionsCount > 0 ? selectionsCount : totalVotes;
  const sortedOptions = [...(pollOptions ?? [])].sort((a, b) => b.votesCount - a.votesCount);
  const truncateChartLabel = (text: string, max = 18) => {
    const value = String(text ?? "").trim();
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
  };
  const chartData = sortedOptions.map((o) => ({
    name: truncateChartLabel(o.optionText),
    fullName: o.optionText,
    value: o.votesCount,
  }));
  const topValue = sortedOptions.reduce((m, o) => Math.max(m, Number(o.votesCount ?? 0)), 0);
  const topWinners = sortedOptions.filter((o) => topValue > 0 && o.votesCount === topValue);
  const hasTieForFirst = topWinners.length > 1;
  const createdAtLabel = poll?.created_at ? formatDateDescriptiveBR(poll.created_at) : "";

  const participationPercent = (totalMembersCount ?? 0) > 0
    ? Math.round((votersCount / Math.max(1, totalMembersCount ?? 0)) * 100)
    : 0;
  const hasLegacyPollWarning = Boolean(
    pollAudit?.is_multiselect_with_possible_legacy_truncation ||
    pollAudit?.is_missing_vote_message_ids_for_all_rows ||
    pollAudit?.is_missing_raw_payload_for_all_rows
  );

  const kpiHelp = {
    selections: {
      whatIs: "Soma das seleções em todas as opções.",
      howToInterpret: "Pode ser maior que o número de votantes se a enquete permitir múltiplas opções por voto.",
      whatToObserve: "Use para ver volume total de escolhas e distribuição entre opções.",
    },
    voteEvents: {
      whatIs: "Quantidade de registros de voto (eventos).",
      howToInterpret: "Se alguém muda o voto, isso gera novos registros. Por isso pode ser maior que ‘Votantes únicos’.",
      whatToObserve: "Alta diferença entre ‘registrados’ e ‘únicos’ indica mudanças/revotações.",
    },
    voters: {
      whatIs: "Quantidade de pessoas únicas que votaram.",
      howToInterpret: "Cada pessoa conta uma vez, mesmo que tenha votado mais de uma vez.",
      whatToObserve: "Compare com ‘Taxa de participação’ para entender alcance no grupo.",
    },
    participation: {
      whatIs: "Percentual de membros do grupo que votaram.",
      howToInterpret: "Votantes únicos ÷ total de membros do grupo.",
      whatToObserve: "Baixa participação pode indicar pergunta pouco clara ou timing ruim.",
    },
  };

  const buildWhatsAppResultText = () => {
    const question = String(poll?.question ?? "");
    const title = makeShortTitle(question);
    const date = poll?.created_at ? formatDateSimpleBR(poll.created_at) : "—";

    const opts = [...(pollOptions ?? [])].sort((a, b) => {
      const d = Number(b.votesCount ?? 0) - Number(a.votesCount ?? 0);
      if (d !== 0) return d;
      return Number(a.optionIndex ?? 0) - Number(b.optionIndex ?? 0);
    });

    const zeroVoteOptions = opts
      .filter((o: any) => Number(o.votesCount ?? 0) <= 0)
      .map((o: any) => String(o.optionText ?? "").trim())
      .filter(Boolean);

    const lines: string[] = [];
    lines.push(`*Enquete - ${title}*`);
    lines.push(`Data: ${date}`);
    lines.push("");
    lines.push("*Pergunta*");
    lines.push(question || "—");
    lines.push("");
    lines.push("*Resultado*");

    if (percentBase <= 0 || totalVotes <= 0) {
      lines.push("Sem votos ainda");
    } else {
      if (hasTieForFirst) {
        lines.push(`Empate na liderança entre ${topWinners.length} opções (${topValue} voto(s))`);
      }
      opts.forEach((o, idx) => {
        const votes = Number(o.votesCount ?? 0);
        const pct = computePollPercent(votes, percentBase, 1);
        const label = String(o.optionText ?? "").trim() || "—";
        lines.push(`- ${idx + 1}) ${label} — ${votes} voto(s) (${pct}%)`);
      });
    }

    lines.push("");
    lines.push("*Engajamento*");
    lines.push(`- Votantes únicos: ${votersCount}`);
    lines.push(`- Total de votos: ${totalVotes}`);
    lines.push("");
    lines.push("*Observação*");
    lines.push(`- Opções sem votos: ${zeroVoteOptions.length ? zeroVoteOptions.join(", ") : "nenhuma"}`);

    return lines.join("\n");
  };

  const copyWhatsAppResult = async () => {
    const text = buildWhatsAppResultText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 1600);
      notify.success("Resultado copiado", "Pronto para colar no WhatsApp.");
    } catch {
      notify.error("Não foi possível copiar automaticamente", "Abra o texto e selecione tudo.");
      openCopyFallback(text);
    }
  };

  return (
    <AdminLayout title="Enquete" subtitle="Detalhes da enquete">
      <div className="space-y-6 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[
            { label: "Central de Comando", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Enquete" },
          ]}
          title="Enquete"
          description={createdAtLabel}
          actions={(
            <>
              <NavLink to={`/groups/${groupId}/polls`} className="ml-auto">
                <Button variant="outline" size="sm">Voltar às enquetes</Button>
              </NavLink>
              <NavLink to={`/groups/${groupId}/messages`}>
                <Button variant="ghost" size="sm">Mensagens</Button>
              </NavLink>
            </>
          )}
        />

        <div className="rounded-xl border border-warning/20 bg-card/95 overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 p-5 border-b border-border/80">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-card-foreground">{poll?.question || "Enquete"}</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Criada em {createdAtLabel}</p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {!poll ? (
              pollLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                </div>
                <Skeleton className="h-56 w-full" />
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </div>
              ) : (
                <EmptyState
                  title="Enquete não encontrada"
                  message="A enquete pode ter sido removida ou você não tem mais acesso a ela."
                />
              )
            ) : (
                <div className="space-y-5">
                  {hasLegacyPollWarning ? (
                    <Alert className="border-amber-300/60 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertTitle>Possível divergência na ingestão dos votos</AlertTitle>
                      <AlertDescription>
                        {pollAudit?.is_multiselect_with_possible_legacy_truncation
                          ? `A enquete foi identificada como multiseleção e há ${Number(pollAudit?.voters_at_two_or_more_events ?? 0)} participante(s) com 2 ou mais eventos. Em registros legados, votos adicionais podem ter sido truncados. `
                          : ""}
                        {pollAudit?.is_missing_vote_message_ids_for_all_rows || pollAudit?.is_missing_raw_payload_for_all_rows
                          ? "Os votos históricos desta enquete não têm rastreabilidade completa para reconstrução automática."
                          : ""}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <KpiCard title="Votos (seleções)" value={totalVotes} help={kpiHelp.selections} />
                    <KpiCard title="Votos registrados" value={voteEventsCount} help={kpiHelp.voteEvents} />
                    <KpiCard title="Votantes únicos" value={votersCount} help={kpiHelp.voters} />
                    <KpiCard title="Taxa de participação" value={`${participationPercent}%`} help={kpiHelp.participation} />
                    <KpiCard title="Máx. opções" value={poll?.max_options ?? 1} helpText="Número máximo de opções que cada pessoa pode selecionar." />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-card-foreground">Resumo do Resultado</div>
                      <div className="text-xs text-muted-foreground">
                        {hasTieForFirst
                          ? `Empate na liderança entre ${topWinners.length} opções.`
                          : "Copie para WhatsApp com a formatação correta."}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyWhatsAppResult()}
                      className="shrink-0"
                      aria-label="Copiar resultado para WhatsApp"
                    >
                      {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      {copied ? "Copiado" : "Copiar resultado (WhatsApp)"}
                    </Button>
                  </div>

                {chartData.length === 0 ? (
                  <div className="h-[260px] flex items-center justify-center bg-muted/20 border border-border/70 rounded-lg">
                    <p className="text-sm text-muted-foreground">Sem dados para o gráfico</p>
                  </div>
                ) : (
                  <ChartContainer config={{ value: { label: "Votos", color: "hsl(var(--primary))" } }} className="h-[260px] w-full">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} width={40} />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value, _name, item) => [
                          value,
                          (item?.payload as { fullName?: string } | undefined)?.fullName || "Opção",
                        ]}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, idx) => {
                          const isWinner = topValue > 0 && entry.value === topValue;
                          return (
                            <Cell
                              key={`cell-${idx}`}
                              fillOpacity={isWinner ? 1 : 0.35}
                              stroke={isWinner ? "hsl(var(--primary))" : "transparent"}
                              strokeWidth={isWinner ? 1 : 0}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}

                <div className="space-y-3">
                  {sortedOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma opção cadastrada.</p>
                  ) : (
                    sortedOptions.map((opt: any) => {
                      const pct = computePollPercent(opt.votesCount, percentBase, 1);
                      const isWinner = topValue > 0 && opt.votesCount === topValue;
                      return (
                        <div key={opt.optionIndex} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={isWinner ? "text-sm text-primary font-medium" : "text-sm text-card-foreground"}>{opt.optionText}</span>
                            <span className="text-xs text-muted-foreground">{opt.votesCount} voto(s) • {pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                            {opt.votesCount <= 0 ? (
                              <div className="h-full w-full rounded-full border border-dashed border-foreground/20" />
                            ) : (
                              <div
                                className={isWinner ? "h-full rounded-full bg-primary transition-[width] duration-500 ease-out" : "h-full rounded-full bg-foreground/20 transition-[width] duration-500 ease-out"}
                                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem value="votes-by-person">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <span>Votos por pessoa</span>
                        <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                          {pollVotesByPerson?.length ?? 0}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {pollVotesByPersonLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/80 px-3 py-2">
                              <Skeleton className="h-8 w-8 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-3 w-40" />
                                <Skeleton className="h-3 w-64" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : !pollVotesByPerson || pollVotesByPerson.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum voto registrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {pollVotesByPerson.map((v: any, idx: number) => (
                            <div key={`${v.personId || idx}-${v.createdAt}`} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-card/80 px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Avatar className="h-8 w-8">
                                      {v.personId && voterAvatarMap?.[v.personId] ? (
                                        <AvatarImage
                                          src={voterAvatarMap[v.personId] || undefined}
                                          alt={v.personName || "Participante"}
                                          referrerPolicy="no-referrer"
                                          onError={() => {
                                            const url = voterAvatarMap?.[v.personId] ?? null;
                                            const key = `${v.personId}::${url ?? ""}`;
                                            if (!loggedAvatarFailuresRef.current.has(key)) {
                                              loggedAvatarFailuresRef.current.add(key);
                                            }
                                          }}
                                        />
                                      ) : null}
                                      <AvatarFallback className="text-xs font-medium text-muted-foreground">
                                        {getInitialsFromName(v.personName) || "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm text-card-foreground truncate">{v.personName || "Participante"}</span>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">
                                    {v.voteSequence && v.votesCount ? `Voto ${v.voteSequence}/${v.votesCount} • ` : ""}
                                    {new Date(v.createdAt).toLocaleString("pt-BR", { timeZone: SAO_PAULO_TZ })}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {(v.votedOptions as string[]).map((o: string, i: number) => (
                                    <span key={`${o}-${i}`} className="text-[11px] px-2 py-0.5 rounded border border-border/60 bg-secondary text-secondary-foreground">{o}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={copyFallbackOpen} onOpenChange={setCopyFallbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar resultado</DialogTitle>
            <DialogDescription>
              Seu navegador bloqueou o acesso ao clipboard. Selecione o texto abaixo e copie manualmente.
            </DialogDescription>
          </DialogHeader>

          <Textarea ref={copyTextareaRef} value={copyFallbackText} readOnly className="min-h-[240px] font-mono text-xs" />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                copyTextareaRef.current?.focus();
                copyTextareaRef.current?.select();
              }}
            >
              Selecionar tudo
            </Button>
            <Button onClick={() => setCopyFallbackOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
