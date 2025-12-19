import { useParams, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { LoadingState } from "@/components/ui/loading-state";
import AccessDenied from "./AccessDenied";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { UserInline } from "@/components/ui/UserInline";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { KpiCard } from "@/components/group-dashboard";

export default function GroupPoll() {
  const { groupId, pollId } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();

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

  const { data: poll, error: pollError } = useQuery({
    queryKey: ["poll", pollId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("polls")
        .select("id, question, max_options, created_at")
        .eq("id", pollId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!pollId && isAuthenticated,
  });

  const { data: pollOptions } = useQuery({
    queryKey: ["poll-options-results", pollId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("v_poll_results")
        .select("option_text, option_index, votes_count")
        .eq("poll_id", pollId)
        .order("option_index", { ascending: true });
      return (data ?? []).map((r: any) => ({
        optionText: r.option_text as string,
        optionIndex: Number(r.option_index),
        votesCount: Number(r.votes_count ?? 0),
      }));
    },
    enabled: !!pollId && isAuthenticated,
  });

  const { data: pollSummary } = useQuery({
    queryKey: ["poll-summary", pollId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("v_poll_summary")
        .select("voters_count")
        .eq("poll_id", pollId)
        .maybeSingle();
      return data;
    },
    enabled: !!pollId && isAuthenticated,
  });

  const { data: pollVotesByPerson } = useQuery({
    queryKey: ["poll-votes-by-person", pollId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("v_poll_votes_by_person")
        .select("person_id, person_name, voted_options, created_at")
        .eq("poll_id", pollId)
        .order("created_at", { ascending: false });
      return (data ?? []).map((r: any) => ({
        personId: r.person_id as string | null,
        personName: r.person_name as string | null,
        votedOptions: Array.isArray(r.voted_options)
          ? (r.voted_options as string[])
          : r.voted_options
          ? Object.values(r.voted_options)
          : [],
        createdAt: r.created_at as string,
      }));
    },
    enabled: !!pollId && isAuthenticated,
  });

  if (authLoading) {
    return (
      <AdminLayout title="Enquete" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (pollError && ((pollError as any).message?.includes("permission") || (pollError as any).code === "PGRST301")) {
    return <AccessDenied message="Você não tem permissão para acessar esta enquete." />;
  }

  const totalVotes = (pollOptions ?? []).reduce((sum: number, o: any) => sum + o.votesCount, 0);
  const sortedOptions = [...(pollOptions ?? [])].sort((a: any, b: any) => b.votesCount - a.votesCount);
  const chartData = sortedOptions.map((o: any) => ({ name: o.optionText, value: o.votesCount }));
  const createdAtLabel = poll ? new Date((poll as any).created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";

  return (
    <AdminLayout title="Enquete" subtitle="Detalhes da enquete">
      <div className="space-y-6 animate-fade-in">
        <Breadcrumbs
          items={[
            { label: "System", href: "/system" },
            { label: groupInfo?.orgName || "Org", href: `/org/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/group/${groupId}` },
            { label: "Enquete" },
          ]}
        />

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-5 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-card-foreground">{(poll as any)?.question || "Enquete"}</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Criada em {createdAtLabel}</p>
            </div>
            <NavLink to={`/group/${groupId}/messages`} className="ml-auto">
              <Button variant="outline" size="sm">Voltar às mensagens</Button>
            </NavLink>
          </div>

          <div className="p-4 space-y-4">
            {!poll ? (
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
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard title="Total de votos" value={totalVotes} />
                  <KpiCard title="Votantes únicos" value={pollSummary?.voters_count ?? 0} />
                  <KpiCard title="Opções" value={(pollOptions ?? []).length} />
                  <KpiCard title="Máx. opções" value={(poll as any).max_options ?? 1} />
                </div>

                {chartData.length === 0 ? (
                  <div className="h-[260px] flex items-center justify-center bg-secondary/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Sem dados para o gráfico</p>
                  </div>
                ) : (
                  <ChartContainer config={{ value: { label: "Votos", color: "hsl(var(--primary))" } }} className="h-[260px] w-full">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                    </BarChart>
                  </ChartContainer>
                )}

                <div className="space-y-3">
                  {sortedOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma opção cadastrada.</p>
                  ) : (
                    sortedOptions.map((opt: any) => {
                      const pct = totalVotes > 0 ? Math.round((opt.votesCount / totalVotes) * 100) : 0;
                      return (
                        <div key={opt.optionIndex} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-card-foreground">{opt.optionText}</span>
                            <span className="text-xs text-muted-foreground">{opt.votesCount} voto(s) • {pct}%</span>
                          </div>
                          <Progress value={pct} />
                        </div>
                      );
                    })
                  )}
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem value="votes-by-person">
                    <AccordionTrigger>Votos por pessoa</AccordionTrigger>
                    <AccordionContent>
                      {!pollVotesByPerson || pollVotesByPerson.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum voto registrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {pollVotesByPerson.map((v: any, idx: number) => (
                            <div key={`${v.personId || idx}-${v.createdAt}`} className="flex items-start justify-between gap-3 rounded-lg bg-card/50 px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <UserInline name={v.personName || "Participante"} avatarUrl={null} />
                                  <span className="text-[11px] text-muted-foreground">{new Date(v.createdAt).toLocaleString("pt-BR")}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {(v.votedOptions as string[]).map((o: string, i: number) => (
                                    <span key={`${o}-${i}`} className="text-[11px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{o}</span>
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
    </AdminLayout>
  );
}
