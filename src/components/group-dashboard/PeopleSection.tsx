import { useState, useMemo } from "react";
import { Crown, Medal } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { Pie, PieChart, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { MemberDetailsDrawer } from "@/components/members/MemberDetailsDrawer";
import { MetricHelp } from "@/components/ui/metric-help";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MemberEngagement {
  recorrentes: number;
  esporadicos: number;
  inativos: number;
}

interface PeopleSectionProps {
  groupId: string;
  topParticipant: { id?: string; name: string; count: number; avatarUrl?: string | null } | null;
  previousTopParticipant?: { id?: string; name: string; count: number; avatarUrl?: string | null } | null;
  topParticipants: { id: string; name: string; count: number; avatarUrl?: string | null }[];
  memberEngagement?: MemberEngagement;
  previousMemberEngagement?: MemberEngagement | null;
  isLoading?: boolean;
  periodLabel?: string;
}

export function PeopleSection({ 
  groupId,
  topParticipant,
  topParticipants,
  memberEngagement,
  previousMemberEngagement,
  isLoading,
  periodLabel = "período",
}: PeopleSectionProps) {
  const formatPeriodSuffix = (label: string) => {
    if (!label || label === "período") return "no período";
    if (/^últimos\s+/i.test(label)) return `nos ${label}`;
    if (/^\d+\s+dias$/i.test(label)) return `nos últimos ${label}`;
    if (label === "hoje") return "hoje";
    if (label === "ontem") return "ontem";
    if (label === "esta semana") return "nesta semana";
    if (label === "semana passada") return "na semana passada";
    if (label === "este mês") return "neste mês";
    return `no período (${label})`;
  };

  const formatBasedOnPeriod = (label: string) => {
    if (!label || label === "período") return "Baseado no período";
    if (/^últimos\s+/i.test(label)) return `Baseado nos ${label}`;
    if (/^\d+\s+dias$/i.test(label)) return `Baseado nos últimos ${label}`;
    if (label === "esta semana") return "Baseado nesta semana";
    if (label === "semana passada") return "Baseado na semana passada";
    if (label === "este mês") return "Baseado neste mês";
    return `Baseado em ${label}`;
  };

  const chartConfig = {
    recorrentes: {
      label: "Recorrentes",
      color: "hsl(var(--success) / 0.35)",
    },
    esporadicos: {
      label: "Esporádicos",
      color: "hsl(var(--warning) / 0.28)",
    },
    inativos: {
      label: "Inativos",
      color: "hsl(var(--muted-foreground) / 0.22)",
    },
  };

  const donutData = memberEngagement ? [
    { name: 'Recorrentes', value: memberEngagement.recorrentes, color: 'hsl(var(--success) / 0.35)' },
    { name: 'Esporádicos', value: memberEngagement.esporadicos, color: 'hsl(var(--warning) / 0.28)' },
    { name: 'Inativos', value: memberEngagement.inativos, color: 'hsl(var(--muted-foreground) / 0.22)' },
  ].filter(d => d.value > 0) : [];

  const top5 = useMemo(() => topParticipants.slice(0, 5), [topParticipants]);

  const [topMemberOpen, setTopMemberOpen] = useState(false);
  const canOpenTopMember = !!topParticipant?.id;
  const periodSuffix = formatPeriodSuffix(periodLabel);
  const basedOnText = formatBasedOnPeriod(periodLabel);
  const highlightPeriodLabel = useMemo(() => {
    if (!periodLabel || periodLabel === "período") return "Período selecionado";
    if (/^últimos\s+/i.test(periodLabel)) return periodLabel.replace(/^últimos\s+/i, "Últimos ");
    if (/^\d+\s+dias$/i.test(periodLabel)) return `Últimos ${periodLabel}`;
    return periodLabel;
  }, [periodLabel]);

  const leftInactivity = useMemo(() => {
    if (!memberEngagement || !previousMemberEngagement) return undefined;
    return previousMemberEngagement.inativos - memberEngagement.inativos;
  }, [memberEngagement, previousMemberEngagement]);

  const deltaRecorrentes = useMemo(() => {
    if (!memberEngagement || !previousMemberEngagement) return undefined;
    return memberEngagement.recorrentes - previousMemberEngagement.recorrentes;
  }, [memberEngagement, previousMemberEngagement]);

  const deltaEsporadicos = useMemo(() => {
    if (!memberEngagement || !previousMemberEngagement) return undefined;
    return memberEngagement.esporadicos - previousMemberEngagement.esporadicos;
  }, [memberEngagement, previousMemberEngagement]);

  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
      <SectionHeader 
        title="Pessoas do Grupo" 
        subtitle="Quem sustenta a conversa"
        linkHref={`/groups/${groupId}/members`}
        linkLabel="Ver todos"
        linkClassName="text-muted-foreground hover:text-foreground"
      />

      <div className="space-y-6">
        <div className="rounded-2xl border border-[#F5D7A7] bg-[#FFF7E9] p-6 border-l-4 border-l-primary/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-card-foreground">Quem sustentou a conversa</p>
              <p className="text-xs text-muted-foreground mt-0.5">{highlightPeriodLabel}</p>
            </div>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-6 w-56" />
                  <Skeleton className="h-4 w-44 mt-2" />
                </div>
              </div>
            ) : topParticipant ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      className={cn("rounded-full", canOpenTopMember && "cursor-pointer")}
                      onClick={() => {
                        if (canOpenTopMember) setTopMemberOpen(true);
                      }}
                    >
                      <Avatar className="h-14 w-14 ring-1 ring-primary/20">
                        {topParticipant.avatarUrl ? (
                          <AvatarImage src={topParticipant.avatarUrl || undefined} alt={topParticipant.name || "Membro mais ativo"} referrerPolicy="no-referrer" />
                        ) : null}
                        <AvatarFallback>
                          <Crown className="h-6 w-6 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                    </button>

                    <div className="min-w-0">
                      <button
                        type="button"
                        className={cn(
                          "max-w-full truncate text-lg sm:text-xl font-semibold text-card-foreground",
                          canOpenTopMember ? "hover:underline" : "cursor-default"
                        )}
                        onClick={() => {
                          if (canOpenTopMember) setTopMemberOpen(true);
                        }}
                      >
                        {topParticipant.name}
                      </button>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="font-semibold text-card-foreground tabular-nums">{topParticipant.count}</span> mensagens {periodSuffix}
                      </p>
                    </div>
                  </div>

                  <span className="hidden sm:inline-flex text-[11px] text-primary font-medium bg-primary/10 px-2 py-1 rounded-full whitespace-nowrap">
                    Sustentou a conversa
                  </span>
                </div>

                <p className="mt-4 text-sm text-muted-foreground">Principal força de participação no período.</p>

                {topParticipant.id ? (
                  <MemberDetailsDrawer
                    open={topMemberOpen}
                    onOpenChange={setTopMemberOpen}
                    memberId={topParticipant.id}
                    groupId={groupId}
                    variant="sheet"
                  />
                ) : null}
              </>
            ) : (
              <div className="h-[104px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Sem dados</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <div className="mb-4">
              <p className="text-sm font-medium text-card-foreground">Top participantes</p>
              <p className="text-xs text-muted-foreground mt-0.5">{basedOnText}</p>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : topParticipants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {top5.map((participant, index) => {
                  const isMedal = index < 3;
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isMedal ? (
                          <Medal className={cn("h-4 w-4", index === 0 ? "text-primary" : "text-muted-foreground")} />
                        ) : (
                          <span className="w-4 text-xs text-muted-foreground tabular-nums text-center">{index + 1}</span>
                        )}
                        <MemberInlineTrigger
                          memberId={participant.id}
                          groupId={groupId}
                          name={participant.name}
                          avatarUrl={participant.avatarUrl}
                          size="sm"
                        />
                      </div>

                      <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {participant.count} mensagens
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="text-sm font-medium text-card-foreground">Distribuição de engajamento</p>
                <p className="text-xs text-muted-foreground mt-0.5">{basedOnText}</p>
              </div>
              <MetricHelp
                metricTitle="Distribuição de engajamento"
                whatIs="Como o grupo se divide entre pessoas recorrentes, esporádicas e inativas no período."
                howToInterpret="Mostra se a conversa é sustentada por uma base que volta com frequência ou por participação mais pontual."
                whatToObserve="Se a fatia de recorrentes diminui e a de inativos cresce, pode ser um sinal de conversa perdendo tração."
              />
            </div>

            {isLoading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : (
              <>
                {memberEngagement ? (
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-semibold text-card-foreground tabular-nums">{memberEngagement.recorrentes}</span> membros participam com frequência
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold text-card-foreground tabular-nums">{memberEngagement.inativos}</span> estão inativos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular-nums">{memberEngagement.esporadicos}</span> participam de vez em quando
                    </p>
                  </div>
                ) : null}

                {donutData.length === 0 ? (
                  <div className="h-[96px] flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Sem dados</p>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[96px] w-full mt-4">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={42}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                )}

                {memberEngagement ? (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-success/40" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground underline decoration-dotted underline-offset-2 cursor-help">
                                Recorrentes
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px]">
                              Pessoas que participam com frequência no período.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-card-foreground/90 font-medium tabular-nums">{memberEngagement.recorrentes}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-warning/35" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground underline decoration-dotted underline-offset-2 cursor-help">
                                Esporádicos
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px]">
                              Pessoas que aparecem de vez em quando no período.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-card-foreground/90 font-medium tabular-nums">{memberEngagement.esporadicos}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                          <span className="text-muted-foreground">Inativos</span>
                        </div>
                        <span className="text-card-foreground/90 font-medium tabular-nums">{memberEngagement.inativos}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground">Evolução recente do engajamento</p>
                      {previousMemberEngagement ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {leftInactivity === undefined ? (
                            "—"
                          ) : leftInactivity > 0 ? (
                            <>
                              <span className="font-semibold text-success tabular-nums">+{leftInactivity}</span> membros deixaram a inatividade
                              {deltaRecorrentes !== undefined && deltaEsporadicos !== undefined ? (
                                <span className="text-xs text-muted-foreground"> ({`recorrentes ${deltaRecorrentes >= 0 ? "+" : ""}${deltaRecorrentes}, esporádicos ${deltaEsporadicos >= 0 ? "+" : ""}${deltaEsporadicos}`})</span>
                              ) : null}
                            </>
                          ) : leftInactivity < 0 ? (
                            <>
                              <span className="font-semibold tabular-nums">{Math.abs(leftInactivity)}</span> membros entraram na inatividade
                            </>
                          ) : (
                            "Sem mudança na inatividade"
                          )}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Sem comparação anterior.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
