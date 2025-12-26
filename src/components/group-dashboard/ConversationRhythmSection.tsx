import { Clock, TrendingUp, TrendingDown } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { 
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis
} from "recharts";
import { cn } from "@/lib/utils";
import { formatDateTickBR } from "@/lib/date";

interface ConversationRhythmSectionProps {
  messagesPerDay: { date: string; count: number }[];
  activeMembersPerDay?: { date: string; count: number }[];
  peakHour?: number;
  peakHourMessages?: number;
  previousPeakHour?: number | null;
  previousPeakHourMessages?: number;
  isLoading?: boolean;
  periodLabel?: string;
}

export function ConversationRhythmSection({ 
  messagesPerDay, 
  activeMembersPerDay,
  peakHour,
  peakHourMessages = 0,
  previousPeakHour,
  previousPeakHourMessages = 0,
  isLoading,
  periodLabel = "período"
}: ConversationRhythmSectionProps) {
  const chartConfig = {
    count: {
      label: "Mensagens",
      color: "hsl(var(--primary))",
    },
    actives: {
      label: "Membros ativos",
      color: "hsl(var(--muted-foreground))",
    },
  };

  const formatDate = (dateStr: string) => {
    return formatDateTickBR(dateStr);
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}h - ${(hour + 1).toString().padStart(2, '0')}h`;
  };

  const formatShortHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}h`;
  };

  // Calculate trend for peak hour messages
  const peakMessagesTrend = previousPeakHourMessages > 0 
    ? Math.round(((peakHourMessages - previousPeakHourMessages) / previousPeakHourMessages) * 100)
    : undefined;

  const peakHourChanged = previousPeakHour !== undefined && previousPeakHour !== null && previousPeakHour !== peakHour;

  // Merge datasets for multi-line chart
  const chartData = messagesPerDay.map(d => {
    const activesCount = activeMembersPerDay?.find(a => a.date === d.date)?.count ?? undefined;
    return { date: d.date, count: d.count, actives: activesCount };
  });

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Ritmo da Conversa" 
        subtitle={`Padrões de atividade (${periodLabel})`}
        helpText="Evolução das mensagens por dia no período. Útil para perceber picos, não para avaliar qualidade."
      />
      
      <div className="space-y-6">
        {/* Main chart - full width */}
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : messagesPerDay.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center bg-secondary/30 rounded-lg">
            <p className="text-sm text-muted-foreground">Sem dados de atividade</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    labelFormatter={(value) => formatDate(String(value))}
                  />
                } 
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 3 }}
              />
              {activeMembersPerDay && activeMembersPerDay.length > 0 && (
                <Line 
                  type="monotone"
                  dataKey="actives"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}
            </LineChart>
          </ChartContainer>
        )}

        {/* Side cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Peak hour card */}
          <div className="rounded-lg border border-border bg-secondary/30 p-4 flex-1">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Horário mais ativo</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : peakHour !== undefined ? (
              <div className="space-y-1">
                <p className="text-lg font-semibold text-card-foreground">
                  {formatHour(peakHour)}
                </p>
                {peakHourChanged && previousPeakHour !== null && (
                  <p className="text-xs text-muted-foreground">
                    antes: {formatShortHour(previousPeakHour)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>

          {/* Peak messages card */}
          <div className="rounded-lg border border-border bg-secondary/30 p-4 flex-1">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Msgs no pico</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : peakHourMessages !== undefined ? (
              <div className="space-y-1">
                <p className="text-lg font-semibold text-card-foreground">
                  {peakHourMessages.toLocaleString('pt-BR')}
                </p>
                {peakMessagesTrend !== undefined && peakMessagesTrend !== 0 && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs",
                    peakMessagesTrend > 0 ? "text-success" : "text-destructive"
                  )}>
                    {peakMessagesTrend > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>
                      {peakMessagesTrend > 0 ? '+' : ''}{peakMessagesTrend}%
                      <span className="text-muted-foreground ml-1">vs anterior</span>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
