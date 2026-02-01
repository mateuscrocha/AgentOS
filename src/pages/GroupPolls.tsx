import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
 
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import AccessDenied from "./AccessDenied";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
 
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, PeriodType, DateRange } from "@/components/group-dashboard/period-utils";
import { Button } from "@/components/ui/button";
import { buildPagination, cn } from "@/lib/utils";
import { computePollPercent } from "@/lib/polls";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { formatDateSimpleBR } from "@/lib/date";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";

type PollRow = Database["public"]["Tables"]["polls"]["Row"];
type PollSummaryRow = Database["public"]["Views"]["v_poll_summary"]["Row"];
type PollResultRow = Database["public"]["Views"]["v_poll_results"]["Row"];

type PollItem = Pick<
  PollRow,
  "id" | "question" | "created_at" | "max_options" | "max_votes_per_member" | "whatsapp_provider_id"
>;

type PollSummaryItem = {
  votersCount: number;
  voteEventsCount: number;
  selectionsCount: number;
};

type PollOptionResult = {
  pollId: string;
  optionText: string;
  optionIndex: number;
  votesCount: number;
};

const PAGE_SIZE = 10;
const QUESTION_LAYOUT_TRANSITION = { duration: 0.22, ease: "easeOut" } as const;

export default function GroupPolls() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const currentRange = getDateRange(selectedPeriod, customRange);
  const hasActiveFilters = selectedPeriod !== '7d' || !!customRange || !!search.trim();

  useEffect(() => {
    const next = search.trim();
    const t = window.setTimeout(() => setDebouncedSearch(next), 300);
    return () => window.clearTimeout(t);
  }, [search]);


  const { data: groupInfo } = useQuery({
    queryKey: ["group-info", groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from("groups")
        .select("name, organization_id, provider, sync_status")
        .eq("id", groupId)
        .maybeSingle();
      if (!group) return null;
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", group.organization_id)
        .maybeSingle();
      return { groupName: group.name, orgName: org?.name, orgId: group.organization_id, provider: group.provider, syncStatus: group.sync_status };
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: totalMembersCount } = useQuery({
    queryKey: ['group-members-total', groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .is('deleted_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: lastMessageAt } = useQuery({
    queryKey: ['group-last-message', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const first = (data ?? [])[0] as { created_at: string } | undefined;
      return first?.created_at ?? null;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: pollsData, isLoading, error } = useQuery({
    queryKey: ["group-polls", groupId, page, currentRange.from.toISOString(), currentRange.to.toISOString(), debouncedSearch],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("polls")
        .select("id, question, created_at, max_options, max_votes_per_member, whatsapp_provider_id", { count: "exact" })
        .eq("group_id", groupId)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString())
        .order("created_at", { ascending: false });

      if (debouncedSearch.length >= 2) {
        q = q.ilike("question", `%${debouncedSearch}%`);
      }

      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return { items: (data ?? []) as PollItem[], count: count ?? 0 };
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: summaryMap } = useQuery({
    queryKey: ["group-polls-summary", pollsData?.items?.map(p => p.id)],
    queryFn: async () => {
      const ids = (pollsData?.items || []).map(p => p.id);
      if (!ids.length) return {} as Record<string, PollSummaryItem>;
      const { data } = await supabase
        .from("v_poll_summary")
        .select("poll_id, voters_count, vote_events_count, selections_count")
        .in("poll_id", ids);

      const map: Record<string, PollSummaryItem> = {};
      for (const r of (data ?? []) as PollSummaryRow[]) {
        if (!r.poll_id) continue;
        map[String(r.poll_id)] = {
          votersCount: Number(r.voters_count ?? 0),
          voteEventsCount: Number(r.vote_events_count ?? 0),
          selectionsCount: Number(r.selections_count ?? 0),
        };
      }
      return map;
    },
    enabled: !!pollsData?.items?.length,
  });

  const { data: resultsMap, error: resultsError } = useQuery({
    queryKey: ["group-polls-results", pollsData?.items?.map(p => p.id)],
    queryFn: async () => {
      const ids = (pollsData?.items || []).map(p => p.id);
      if (!ids.length) return {} as Record<string, PollOptionResult[]>;

      const { data, error } = await supabase
        .from("v_poll_results")
        .select("poll_id, option_text, option_index, votes_count")
        .in("poll_id", ids)
        .order("poll_id", { ascending: true })
        .order("option_index", { ascending: true });

      if (error) throw error;

      const map: Record<string, PollOptionResult[]> = {};
      for (const r of (data ?? []) as PollResultRow[]) {
        if (!r.poll_id) continue;
        const pollId = String(r.poll_id);
        (map[pollId] ||= []).push({
          pollId,
          optionText: String(r.option_text ?? "").trim() || "—",
          optionIndex: Number(r.option_index ?? 0),
          votesCount: Number(r.votes_count ?? 0),
        });
      }

      return map;
    },
    enabled: !!pollsData?.items?.length && isAuthenticated,
  });

  if (authLoading) {
    return (
      <AdminLayout title="Enquetes" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  const errorMessage = error instanceof Error ? error.message : "";
  const errorCode = (() => {
    if (!error || typeof error !== "object") return "";
    if (!("code" in error)) return "";
    return String((error as { code?: unknown }).code ?? "");
  })();

  if (error && (errorMessage.includes("permission") || errorCode === "PGRST301")) {
    return <AccessDenied message="Você não tem permissão para acessar as enquetes deste grupo." />;
  }

  return (
    <AdminLayout title="Enquetes" subtitle={`${groupInfo?.groupName ? `${groupInfo.groupName} — ` : ""}${pollsData?.count ?? 0} no período selecionado`}>
      <div className="animate-fade-in -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-8 sm:pb-10 bg-background space-y-6">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Enquetes" },
          ]}
          group={{
            groupId: groupId as string,
            organizationId: groupInfo?.orgId || undefined,
            name: groupInfo?.groupName || "",
            provider: groupInfo?.provider || "",
            totalMembers: (totalMembersCount ?? 0) as number,
            lastMessageAt: lastMessageAt ?? null,
            syncStatus: groupInfo?.syncStatus || null,
          }}
          filters={(
            <div className="flex items-center gap-3">
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar pergunta…"
                className="h-9 w-[220px] max-w-[45vw] bg-card"
                aria-label="Buscar por texto da pergunta"
              />
              <PeriodFilter
                value={selectedPeriod}
                customRange={customRange}
                onChange={(p, r) => { setSelectedPeriod(p); setCustomRange(p === 'custom' ? r : undefined); setPage(1); }}
              />
              <span className="hidden sm:inline text-xs text-muted-foreground">Período</span>
            </div>
          )}
          showClearFilters={hasActiveFilters}
          onClearFilters={() => {
            setSelectedPeriod('7d');
            setCustomRange(undefined);
            setSearch("");
            setPage(1);
          }}
        />

        <div className="sr-only" aria-live="polite">
          {(pollsData?.count ?? 0)} enquetes no período selecionado{debouncedSearch ? ` (busca: ${debouncedSearch})` : ""}.
        </div>

        {error || resultsError ? (
          <ErrorState
            title="Não foi possível carregar as enquetes."
            message="Tente novamente."
            retry={() => {
              queryClient.invalidateQueries({ queryKey: ["group-polls", groupId] });
              queryClient.invalidateQueries({ queryKey: ["group-polls-results"] });
              queryClient.invalidateQueries({ queryKey: ["group-polls-summary"] });
            }}
          />
        ) : isLoading ? (
          <div className="space-y-4" aria-label="Carregando enquetes">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-5 w-2/3" />
                      </div>
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-9 w-36 rounded-lg" />
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3.5 py-3">
                      <Skeleton className="h-3 w-32" />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((__, j) => (
                        <div key={j} className="rounded-xl px-2 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                          <Skeleton className="mt-2 h-2 w-full rounded-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !pollsData?.items?.length ? (
          <EmptyState
            icon={ListChecks}
            title="Sem enquetes"
            message="Ainda não há enquetes neste grupo."
          />
        ) : (
          <div className="space-y-4">
            {(pollsData.items || []).map((p) => {
              const options = (resultsMap?.[p.id] || [])
                .slice()
                .sort((a, b) => a.optionIndex - b.optionIndex);

              const totalVotes = options.reduce((sum, o) => sum + o.votesCount, 0);
              const maxVotes = options.reduce((m, o) => Math.max(m, o.votesCount), 0);
              const summary = summaryMap?.[p.id];
              const voteEventsCount = summary?.voteEventsCount ?? 0;
              const selectionsCount = summary?.selectionsCount ?? 0;
              const percentBase = selectionsCount > 0 ? selectionsCount : totalVotes;
              const createdAtLabel = formatDateSimpleBR(p.created_at);
              const winner = options.length ? options.reduce((best, cur) => (cur.votesCount > best.votesCount ? cur : best), options[0] as PollOptionResult) : null;
              const showQuestionToggle = (p.question || "").length >= 130 || /\n/.test(p.question || "");
              const isQuestionExpanded = !!expandedQuestions[p.id];

              return (
                <section
                  key={p.id}
                  className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden"
                  role="article"
                  aria-labelledby={`poll-${p.id}-title`}
                >
                  <motion.div layout initial={false} transition={QUESTION_LAYOUT_TRANSITION} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <motion.div layout transition={QUESTION_LAYOUT_TRANSITION} className="min-w-0">
                        <motion.h3
                          layout
                          transition={QUESTION_LAYOUT_TRANSITION}
                          id={`poll-${p.id}-title`}
                          className={cn(
                            "text-[16px] sm:text-[18px] font-semibold text-foreground leading-snug",
                            !isQuestionExpanded && "line-clamp-3"
                          )}
                        >
                          {p.question || "Enquete"}
                        </motion.h3>

                        {showQuestionToggle ? (
                          <button
                            type="button"
                            className="mt-2 text-xs font-medium text-primary hover:underline underline-offset-2"
                            onClick={(e) => {
                              e.preventDefault();
                              setExpandedQuestions((prev) => ({ ...prev, [p.id]: !prev[p.id] }));
                            }}
                          >
                            {isQuestionExpanded ? "Recolher pergunta" : "Ler pergunta completa"}
                          </button>
                        ) : null}

                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">Criada em {createdAtLabel}</span> • <span className="tabular-nums">{voteEventsCount}</span> votos registrados
                        </div>
                      </motion.div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/groups/${groupId}/polls/${p.id}`)}
                        className="shrink-0 text-primary hover:bg-primary/10"
                        aria-label="Abrir detalhes da enquete"
                      >
                        <span className="hidden sm:inline">Entender respostas</span>
                        <ChevronRight className="h-4 w-4 sm:ml-1" />
                      </Button>
                    </div>

                    {options.length === 0 ? (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground">Ainda não há respostas registradas para esta enquete.</p>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {winner ? (
                          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3.5 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold uppercase tracking-wide text-primary">Resultado principal</div>
                                <div className="mt-1 flex items-center gap-2">
                                  <div className="text-sm font-semibold text-foreground break-words">{winner.optionText}</div>
                                  <Badge variant="secondary" className="h-6 px-2 text-[11px] bg-primary text-primary-foreground">
                                    Mais votada
                                  </Badge>
                                </div>
                              </div>
                              <div className="shrink-0 text-xs text-primary tabular-nums font-medium">
                                {winner.votesCount} voto(s)
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          {options.map((opt) => {
                            const pct = computePollPercent(opt.votesCount, percentBase, 0);
                            const isWinner = maxVotes > 0 && opt.votesCount === maxVotes;
                            return (
                              <div key={`${p.id}-${opt.optionIndex}`} className={cn("rounded-xl px-2 py-2", isWinner ? "bg-primary/5" : "bg-transparent")}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={cn("text-sm", isWinner ? "text-primary font-medium" : "text-foreground")}>{opt.optionText}</span>
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{opt.votesCount} • {pct}%</span>
                                </div>

                                <div className="mt-2 h-2 rounded-full bg-muted/60 overflow-hidden">
                                  {opt.votesCount <= 0 ? (
                                    <div className="h-full w-full rounded-full border border-dashed border-foreground/20" />
                                  ) : (
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-[width] duration-500 ease-out",
                                        isWinner ? "bg-primary" : "bg-foreground/20",
                                      )}
                                      style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </section>
              );
            })}

            {(pollsData.count ?? 0) > PAGE_SIZE ? (
              <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                {(() => {
                  const totalPages = Math.max(1, Math.ceil((pollsData.count ?? 0) / PAGE_SIZE));
                  const items = buildPagination(page, totalPages);
                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        Página <span className="font-medium text-foreground tabular-nums">{page}</span> de{" "}
                        <span className="font-medium text-foreground tabular-nums">{totalPages}</span>
                      </div>

                      <Pagination className="sm:justify-end">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              size="default"
                              onClick={(e) => {
                                e.preventDefault();
                                if (page <= 1) return;
                                setPage(page - 1);
                              }}
                              className={cn("gap-1 pl-2.5", page <= 1 && "pointer-events-none opacity-50")}
                              aria-label="Página anterior"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              <span>Anterior</span>
                            </PaginationLink>
                          </PaginationItem>

                          <div className="hidden sm:flex items-center gap-1">
                            {items.map((it, idx) => (
                              <PaginationItem key={`${it}-${idx}`}>
                                {it === "ellipsis" ? (
                                  <PaginationEllipsis />
                                ) : (
                                  <PaginationLink
                                    href="#"
                                    isActive={it === page}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setPage(it);
                                    }}
                                    aria-label={`Ir para página ${it}`}
                                  >
                                    {it}
                                  </PaginationLink>
                                )}
                              </PaginationItem>
                            ))}
                          </div>

                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              size="default"
                              onClick={(e) => {
                                e.preventDefault();
                                if (page >= totalPages) return;
                                setPage(page + 1);
                              }}
                              className={cn("gap-1 pr-2.5", page >= totalPages && "pointer-events-none opacity-50")}
                              aria-label="Próxima página"
                            >
                              <span>Próxima</span>
                              <ChevronRight className="h-4 w-4" />
                            </PaginationLink>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
