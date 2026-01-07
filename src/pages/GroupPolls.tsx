import { useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computePollPercent } from "@/lib/polls";

interface PollItem {
  id: string;
  question: string;
  created_at: string;
  max_options: number | null;
  max_votes_per_member: number | null;
  whatsapp_provider_id: string | null;
}

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

export default function GroupPolls() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const currentRange = getDateRange(selectedPeriod, customRange);
  const hasActiveFilters = selectedPeriod !== '7d' || !!customRange;


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
    queryKey: ["group-polls", groupId, page, currentRange.from.toISOString(), currentRange.to.toISOString()],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await (supabase as any)
        .from("polls")
        .select("id, question, created_at, max_options, max_votes_per_member, whatsapp_provider_id", { count: "exact" })
        .eq("group_id", groupId)
        .gte("created_at", currentRange.from.toISOString())
        .lte("created_at", currentRange.to.toISOString())
        .order("created_at", { ascending: false })
        .range(from, to);
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
      const { data } = await (supabase as any)
        .from("v_poll_summary")
        .select("poll_id, voters_count, vote_events_count, selections_count")
        .in("poll_id", ids);
      const map: Record<string, PollSummaryItem> = {};
      for (const r of data || []) {
        map[r.poll_id as string] = {
          votersCount: Number(r.voters_count || 0),
          voteEventsCount: Number(r.vote_events_count || 0),
          selectionsCount: Number(r.selections_count || 0),
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

      const { data, error } = await (supabase as any)
        .from("v_poll_results")
        .select("poll_id, option_text, option_index, votes_count")
        .in("poll_id", ids)
        .order("poll_id", { ascending: true })
        .order("option_index", { ascending: true });

      if (error) throw error;

      const map: Record<string, PollOptionResult[]> = {};
      for (const r of data || []) {
        const pollId = r.poll_id as string;
        (map[pollId] ||= []).push({
          pollId,
          optionText: r.option_text as string,
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

  const errorCode = (error as any)?.code;
  if (error && (error.message?.includes("permission") || errorCode === "PGRST301")) {
    return <AccessDenied message="Você não tem permissão para acessar as enquetes deste grupo." />;
  }

  return (
    <AdminLayout title="Enquetes" subtitle={`${groupInfo?.groupName ? `${groupInfo.groupName} — ` : ""}${pollsData?.count ?? 0} no período selecionado`}>
      <div className="space-y-6 animate-fade-in">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Enquetes" },
          ]}
          group={{
            groupId: groupId as string,
            name: groupInfo?.groupName || "",
            provider: groupInfo?.provider || "",
            totalMembers: (totalMembersCount ?? 0) as number,
            lastMessageAt: lastMessageAt ?? null,
            syncStatus: groupInfo?.syncStatus || null,
          }}
          activeTab="enquetes"
          filters={(
            <PeriodFilter
              value={selectedPeriod}
              customRange={customRange}
              onChange={(p, r) => { setSelectedPeriod(p); setCustomRange(p === 'custom' ? r : undefined); setPage(1); }}
            />
          )}
          showClearFilters={hasActiveFilters}
          onClearFilters={() => { setSelectedPeriod('7d'); setCustomRange(undefined); setPage(1); }}
        />

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
          <LoadingState message="Carregando enquetes..." />
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
              const votersCount = summary?.votersCount ?? 0;
              const voteEventsCount = summary?.voteEventsCount ?? 0;
              const selectionsCount = summary?.selectionsCount ?? 0;
              const percentBase = selectionsCount > 0 ? selectionsCount : totalVotes;
              const createdAtLabel = new Date(p.created_at).toLocaleString("pt-BR");

              return (
                <section key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-border">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-card-foreground leading-snug">{p.question || "Enquete"}</h3>
                      <p className="text-xs text-muted-foreground mt-1">Criada em {createdAtLabel} • {votersCount} votante(s) • {voteEventsCount} voto(s)</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/groups/${groupId}/polls/${p.id}`)}
                      className="shrink-0"
                    >
                      Ver detalhes
                    </Button>
                  </div>

                  <div className="p-4 space-y-3">
                    {options.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Ainda não há resultados para esta enquete.</p>
                    ) : (
                      options.map((opt) => {
                        const pct = computePollPercent(opt.votesCount, percentBase, 0);
                        const isWinner = maxVotes > 0 && opt.votesCount === maxVotes;
                        return (
                          <div key={`${p.id}-${opt.optionIndex}`} className={cn("space-y-1", isWinner && "rounded-lg bg-primary/5 p-2")}> 
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn("text-sm", isWinner ? "text-primary font-medium" : "text-card-foreground")}>{opt.optionText}</span>
                                  {isWinner ? (
                                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                      Mais votada
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <span className="shrink-0 text-xs text-muted-foreground">{opt.votesCount} voto(s) • {pct}%</span>
                            </div>
                            <Progress value={pct} />
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}

            {(pollsData.count ?? 0) > PAGE_SIZE ? (
              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/20">
                  <p className="text-xs text-muted-foreground">Página {page} de {Math.ceil((pollsData.count ?? 0) / PAGE_SIZE)} • {pollsData.count ?? 0} itens</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="sr-only">Página anterior</span>
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page >= Math.ceil((pollsData.count ?? 0) / PAGE_SIZE)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="sr-only">Próxima página</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
