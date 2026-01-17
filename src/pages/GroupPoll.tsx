import { useMemo, useRef, useState } from "react";
import { useParams, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { LoadingState } from "@/components/ui/loading-state";
import AccessDenied from "./AccessDenied";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Activity, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { KpiCard } from "@/components/group-dashboard";
import { formatDateDescriptiveBR, formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";
import { computePollPercent, normalizeVotedOptions } from "@/lib/polls";
import { notify } from "@/components/ui/sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function GroupPoll() {
  const { groupId, pollId } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [copyFallbackOpen, setCopyFallbackOpen] = useState(false);
  const [copyFallbackText, setCopyFallbackText] = useState("");
  const copyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const loggedAvatarFailuresRef = useRef<Set<string>>(new Set());

  const getNameInitials = (name: string | null | undefined) => {
    const raw = (name ?? "").trim();
    if (!raw) return "?";
    const parts = raw.split(/\s+/).filter(Boolean);
    const first = (parts[0]?.[0] ?? "").toUpperCase();
    if (parts.length >= 2) {
      const last = (parts[parts.length - 1]?.[0] ?? "").toUpperCase();
      return `${first}${last}` || "?";
    }
    return first || "?";
  };

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
        .select("voters_count, vote_events_count, selections_count")
        .eq("poll_id", pollId)
        .maybeSingle();
      return data;
    },
    enabled: !!pollId && isAuthenticated,
  });

  const { data: pollVotesByPerson, isLoading: pollVotesByPersonLoading } = useQuery({
    queryKey: ["poll-votes-by-person", pollId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("v_poll_votes_by_person")
        .select("person_id, person_name, voted_options, created_at, vote_sequence, votes_count")
        .eq("poll_id", pollId)
        .order("created_at", { ascending: false });
      return (data ?? []).map((r: any) => ({
        personId: r.person_id as string | null,
        personName: r.person_name as string | null,
        votedOptions: normalizeVotedOptions(r.voted_options),
        createdAt: r.created_at as string,
        voteSequence: Number(r.vote_sequence ?? 0) || null,
        votesCount: Number(r.votes_count ?? 0) || null,
      }));
    },
    enabled: !!pollId && isAuthenticated,
  });

  const voterIds = useMemo(() => {
    const ids = (pollVotesByPerson ?? [])
      .map((v: any) => v.personId as string | null)
      .filter((id: string | null): id is string => !!id);
    return Array.from(new Set(ids)).sort();
  }, [pollVotesByPerson]);

  const { data: voterAvatarMap } = useQuery({
    queryKey: ["poll-voters-avatars", groupId, voterIds],
    queryFn: async () => {
      if (!voterIds.length || !groupId) return {} as Record<string, string | null>;
      const { data, error } = await (supabase as any)
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
  const votersCount = Number((pollSummary as any)?.voters_count ?? 0);
  const voteEventsCount = Number((pollSummary as any)?.vote_events_count ?? 0);
  const selectionsCount = Number((pollSummary as any)?.selections_count ?? 0);
  const percentBase = selectionsCount > 0 ? selectionsCount : totalVotes;
  const sortedOptions = [...(pollOptions ?? [])].sort((a: any, b: any) => b.votesCount - a.votesCount);
  const chartData = sortedOptions.map((o: any) => ({ name: o.optionText, value: o.votesCount }));
  const createdAtLabel = poll ? formatDateDescriptiveBR((poll as any).created_at) : "";

  const buildWhatsAppResultText = () => {
    const question = String((poll as any)?.question ?? "");
    const title = makeShortTitle(question);
    const date = (poll as any)?.created_at ? formatDateSimpleBR((poll as any).created_at) : "—";

    const opts = [...(pollOptions ?? [])].sort((a: any, b: any) => {
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
      opts.forEach((o: any, idx: number) => {
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
            <NavLink to={`/groups/${groupId}/messages`} className="ml-auto">
              <Button variant="outline" size="sm">Voltar às mensagens</Button>
            </NavLink>
          )}
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
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <KpiCard title="Votos (seleções)" value={totalVotes} />
                    <KpiCard title="Votos registrados" value={voteEventsCount} />
                    <KpiCard title="Votantes únicos" value={votersCount} />
                    <KpiCard title="Máx. opções" value={(poll as any).max_options ?? 1} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-card-foreground">Resumo do Resultado</div>
                      <div className="text-xs text-muted-foreground">Copie para WhatsApp com a formatação correta.</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void copyWhatsAppResult()} className="shrink-0">
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar resultado (WhatsApp)
                    </Button>
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
                      const pct = computePollPercent(opt.votesCount, percentBase, 1);
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
                      {pollVotesByPersonLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-lg bg-card/50 px-3 py-2">
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
                            <div key={`${v.personId || idx}-${v.createdAt}`} className="flex items-start justify-between gap-3 rounded-lg bg-card/50 px-3 py-2">
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
                                              if (import.meta.env.DEV) {
                                                console.warn("[poll-avatar] falha ao carregar", {
                                                  memberId: v.personId,
                                                  avatarUrl: url,
                                                  status: undefined,
                                                });
                                              }
                                            }
                                          }}
                                        />
                                      ) : null}
                                      <AvatarFallback className="text-xs font-medium text-muted-foreground">
                                        {getNameInitials(v.personName)}
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
