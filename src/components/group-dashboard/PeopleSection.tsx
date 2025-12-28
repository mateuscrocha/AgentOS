import { User, Users, Crown, TrendingUp, TrendingDown } from "lucide-react";
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
  previousTopParticipant,
  topParticipants,
  memberEngagement,
  previousMemberEngagement,
  isLoading,
  periodLabel = "período"
}: PeopleSectionProps) {
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

  // Calculate top participant trend
  const topParticipantTrend = topParticipant && previousTopParticipant
    ? topParticipant.count - previousTopParticipant.count
    : undefined;

  // Calculate engagement distribution trends
  const getEngagementTrend = (key: keyof MemberEngagement) => {
    if (!memberEngagement || !previousMemberEngagement) return undefined;
    return memberEngagement[key] - previousMemberEngagement[key];
  };

  const recorrentesTrend = getEngagementTrend('recorrentes');
  const esporadicosTrend = getEngagementTrend('esporadicos');
  const inativosTrend = getEngagementTrend('inativos');

  const TrendIndicator = ({ value, inverted = false }: { value: number | undefined; inverted?: boolean }) => {
    if (value === undefined || value === 0) return null;
    const isPositive = inverted ? value < 0 : value > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    return (
      <span className={cn(
        "inline-flex items-center gap-0.5 text-xs",
        isPositive ? "text-success" : "text-destructive"
      )}>
        <Icon className="h-3 w-3" />
        {value > 0 ? '+' : ''}{value}
      </span>
    );
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Pessoas do Grupo" 
        subtitle={`Quem sustenta a conversa (${periodLabel})`}
        linkHref={`/groups/${groupId}/members`}
        linkLabel="Ver todos"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top participant highlight */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col items-center text-center">
          <div className="mb-3">
            {isLoading ? (
              <Skeleton className="h-16 w-16 rounded-full" />
            ) : topParticipant?.id ? (
              <MemberInlineTrigger
                memberId={topParticipant.id}
                groupId={groupId}
                name={topParticipant.name}
                avatarUrl={topParticipant.avatarUrl}
                size="md"
              />
            ) : (
              <Avatar className="h-16 w-16">
                {topParticipant?.avatarUrl ? (
                  <AvatarImage src={topParticipant.avatarUrl || undefined} alt={topParticipant?.name || "Membro mais ativo"} />
                ) : null}
                <AvatarFallback>
                  <Crown className="h-8 w-8 text-primary" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-4 w-16" />
            </>
          ) : topParticipant ? (
            <>
              {!topParticipant.id && (
                <p className="font-semibold text-card-foreground truncate max-w-full">
                  {topParticipant.name}
                </p>
              )}
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {topParticipant.count} mensagens
                </p>
                {topParticipantTrend !== undefined && topParticipantTrend !== 0 && (
                  <span className={cn(
                    "flex items-center gap-0.5 text-xs",
                    topParticipantTrend > 0 ? "text-success" : "text-destructive"
                  )}>
                    {topParticipantTrend > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {topParticipantTrend > 0 ? '+' : ''}{topParticipantTrend}
                  </span>
                )}
              </div>
              <span className="mt-2 text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
                Membro mais ativo
              </span>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          )}
        </div>

        {/* Top 5 list */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Top 5 participantes</p>
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
              {topParticipants.slice(0, 5).map((participant, index) => (
                <div 
                  key={participant.name} 
                  className="flex items-center gap-3 p-2 rounded-lg bg-card/50"
                >
                  <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-primary text-primary-foreground' :
                    index === 1 ? 'bg-accent text-accent-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <MemberInlineTrigger
                      memberId={participant.id}
                      groupId={groupId}
                      name={participant.name}
                      avatarUrl={participant.avatarUrl}
                      size="sm"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {participant.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Engagement donut */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Distribuição de engajamento</p>
          {isLoading ? (
            <Skeleton className="h-[150px] w-full" />
          ) : donutData.length === 0 ? (
            <div className="h-[150px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Sem dados</p>
            </div>
          ) : (
            <>
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
              
              {/* Legend with trends */}
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {memberEngagement && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-success" />
                      <span className="text-xs text-muted-foreground">
                        Recorrentes ({memberEngagement.recorrentes})
                      </span>
                      <TrendIndicator value={recorrentesTrend} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                      <span className="text-xs text-muted-foreground">
                        Esporádicos ({memberEngagement.esporadicos})
                      </span>
                      <TrendIndicator value={esporadicosTrend} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Inativos ({memberEngagement.inativos})
                      </span>
                      <TrendIndicator value={inativosTrend} inverted />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
