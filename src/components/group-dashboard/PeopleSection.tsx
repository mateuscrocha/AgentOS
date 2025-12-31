import { useState, useMemo } from "react";
import { Crown, HelpCircle } from "lucide-react";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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
  totalMessagesInPeriod?: number;
}

export function PeopleSection({ 
  groupId,
  topParticipant,
  previousTopParticipant,
  topParticipants,
  memberEngagement,
  previousMemberEngagement,
  isLoading,
  periodLabel = "período",
  totalMessagesInPeriod,
}: PeopleSectionProps) {
  // UX: padroniza o texto do período para dar contexto imediato às métricas (ex.: "nos últimos 7 dias").
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

  // UX: mantém consistência de leitura em subtítulos ("Baseado nos últimos 7 dias" etc.).
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
      color: "hsl(var(--success))",
    },
    esporadicos: {
      label: "Esporádicos",
      color: "hsl(var(--warning))",
    },
    inativos: {
      label: "Inativos",
      color: "hsl(var(--muted))",
    },
  };

  const donutData = memberEngagement ? [
    { name: 'Recorrentes', value: memberEngagement.recorrentes, color: 'hsl(var(--success))' },
    { name: 'Esporádicos', value: memberEngagement.esporadicos, color: 'hsl(var(--warning))' },
    { name: 'Inativos', value: memberEngagement.inativos, color: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0) : [];

  const engagementDelta = (key: keyof MemberEngagement) => {
    if (!memberEngagement || !previousMemberEngagement) return undefined;
    return memberEngagement[key] - previousMemberEngagement[key];
  };

  const top5 = useMemo(() => topParticipants.slice(0, 5), [topParticipants]);
  const maxTop5Count = useMemo(() => {
    const values = top5.map(p => p.count);
    return values.length > 0 ? Math.max(...values) : 0;
  }, [top5]);

  const totalMessages = Math.max(0, Number(totalMessagesInPeriod ?? 0));
  const showTop5Percent = totalMessages > 0;

  const [topMemberOpen, setTopMemberOpen] = useState(false);
  const canOpenTopMember = !!topParticipant?.id;
  const periodSuffix = formatPeriodSuffix(periodLabel);
  const basedOnText = formatBasedOnPeriod(periodLabel);
  const engagementHelpText = (
    <div className="space-y-1">
      <div><strong>Recorrentes</strong>: enviaram mensagens em vários dias.</div>
      <div><strong>Esporádicos</strong>: enviaram poucas mensagens.</div>
      <div><strong>Inativos</strong>: não enviaram mensagens.</div>
    </div>
  );

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Pessoas do Grupo" 
        subtitle={`Quem sustenta a conversa (${periodLabel})`}
        linkHref={`/groups/${groupId}/members`}
        linkLabel="Ver todos"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* UX: hierarquia mais humana (nome em destaque) + contexto de período explícito + badge significativo. */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">Membro mais ativo no período</p>
            <span className="text-[11px] text-primary font-medium bg-primary/10 px-2 py-1 rounded-full whitespace-nowrap">
              Sustentou a conversa
            </span>
          </div>

          <div className="mt-3 flex flex-col items-center text-center">
            {isLoading ? (
              <>
                <Skeleton className="h-[72px] w-[72px] rounded-full" />
                <Skeleton className="h-5 w-44 mt-3" />
                <Skeleton className="h-4 w-36 mt-2" />
              </>
            ) : topParticipant ? (
              <>
                <button
                  type="button"
                  className={cn("rounded-full", canOpenTopMember && "cursor-pointer")}
                  onClick={() => {
                    if (canOpenTopMember) setTopMemberOpen(true);
                  }}
                >
                  <Avatar className="h-[72px] w-[72px] ring-2 ring-primary/15 shadow-sm">
                    {topParticipant.avatarUrl ? (
                      <AvatarImage src={topParticipant.avatarUrl || undefined} alt={topParticipant.name || "Membro mais ativo"} referrerPolicy="no-referrer" />
                    ) : null}
                    <AvatarFallback>
                      <Crown className="h-8 w-8 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                </button>

                <button
                  type="button"
                  className={cn(
                    "mt-3 max-w-full truncate text-base font-semibold text-card-foreground",
                    canOpenTopMember ? "hover:underline" : "cursor-default"
                  )}
                  onClick={() => {
                    if (canOpenTopMember) setTopMemberOpen(true);
                  }}
                >
                  {topParticipant.name}
                </button>

                <p className="mt-1 text-sm text-muted-foreground">
                  {topParticipant.count} mensagens {periodSuffix}
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  Participou ativamente do grupo ao longo do período.
                </p>

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
              <div className="h-[132px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Sem dados</p>
              </div>
            )}
          </div>
        </div>

        {/* UX: adiciona contexto do período e barra proporcional para leitura instantânea do ranking. */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="mb-3">
            <p className="text-sm font-medium text-muted-foreground">Top 5 participantes do período</p>
            <p className="text-xs text-muted-foreground mt-0.5">{basedOnText}</p>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : topParticipants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <div className="space-y-2">
              {top5.map((participant, index) => {
                const ratio = maxTop5Count > 0 ? participant.count / maxTop5Count : 0;
                const percent = showTop5Percent ? Math.round((participant.count / totalMessages) * 100) : undefined;
                const barWidth = participant.count === 0 ? 0 : Math.max(6, Math.round(ratio * 100));
                return (
                <div 
                  key={participant.id} 
                  className="flex items-center gap-3 p-2 rounded-lg bg-card/50"
                >
                  <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-primary text-primary-foreground' :
                    index === 1 ? 'bg-accent text-accent-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <MemberInlineTrigger
                      memberId={participant.id}
                      groupId={groupId}
                      name={participant.name}
                      avatarUrl={participant.avatarUrl}
                      size="sm"
                    />
                  </div>
                  <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                    <div className="h-2 rounded bg-primary/30" style={{ width: `${barWidth}%` }} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground tabular-nums">{participant.count}</div>
                    {showTop5Percent && percent !== undefined ? (
                      <div className="text-[11px] text-muted-foreground">{percent}% do período</div>
                    ) : null}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* UX: separa conceitos (o que é cada categoria) de números e variação para reduzir confusão. */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Distribuição de engajamento do grupo</p>
              <p className="text-xs text-muted-foreground mt-0.5">{basedOnText}</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{engagementHelpText}</TooltipContent>
            </Tooltip>
          </div>
          {isLoading ? (
            <Skeleton className="h-[150px] w-full" />
          ) : (
            <>
              {donutData.length === 0 ? (
                <div className="h-[120px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Sem dados</p>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[120px] w-full">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
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
                <div className="mt-3 space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-success" />
                        <span className="text-muted-foreground">Recorrentes</span>
                      </div>
                      <span className="text-card-foreground tabular-nums">{memberEngagement.recorrentes} membros</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                        <span className="text-muted-foreground">Esporádicos</span>
                      </div>
                      <span className="text-card-foreground tabular-nums">{memberEngagement.esporadicos} membros</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                        <span className="text-muted-foreground">Inativos</span>
                      </div>
                      <span className="text-card-foreground tabular-nums">{memberEngagement.inativos} membros</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground">Variação vs período anterior</p>
                    {previousMemberEngagement ? (
                      <div className="mt-2 space-y-1 text-sm">
                        {(["recorrentes", "esporadicos", "inativos"] as const).map((k) => {
                          const delta = engagementDelta(k);
                          const label = k === "recorrentes" ? "recorrentes" : k === "esporadicos" ? "esporádicos" : "inativos";
                          const formatted = delta === undefined ? "—" : `${delta >= 0 ? "+" : ""}${delta}`;
                          const color = delta === undefined || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-success" : "text-destructive";
                          return (
                            <div key={k} className="flex items-center justify-between">
                              <span className="text-muted-foreground">{label}</span>
                              <span className={cn("tabular-nums", color)}>{formatted}</span>
                            </div>
                          );
                        })}
                      </div>
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
    </section>
  );
}
