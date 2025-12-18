import { User, Users, Crown } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { Pie, PieChart, Cell } from "recharts";

interface PeopleSectionProps {
  groupId: string;
  topParticipant: { name: string; count: number } | null;
  topParticipants: { name: string; count: number }[];
  memberEngagement?: {
    recorrentes: number;
    esporadicos: number;
    inativos: number;
  };
  isLoading?: boolean;
  periodLabel?: string;
}

export function PeopleSection({ 
  groupId,
  topParticipant,
  topParticipants,
  memberEngagement,
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

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Pessoas do Grupo" 
        subtitle={`Quem sustenta a conversa (${periodLabel})`}
        linkHref={`/group/${groupId}/members`}
        linkLabel="Ver todos"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top participant highlight */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-full" />
            ) : (
              <Crown className="h-8 w-8 text-primary" />
            )}
          </div>
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-4 w-16" />
            </>
          ) : topParticipant ? (
            <>
              <p className="font-semibold text-card-foreground truncate max-w-full">
                {topParticipant.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {topParticipant.count} mensagens
              </p>
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
                  <span className="flex-1 text-sm text-card-foreground truncate">
                    {participant.name}
                  </span>
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
              
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {donutData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div 
                      className="h-2.5 w-2.5 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.name} ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
