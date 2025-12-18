import { Clock, TrendingUp } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { 
  Line, 
  LineChart, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Area,
  AreaChart
} from "recharts";

interface ConversationRhythmSectionProps {
  messagesPerDay: { date: string; count: number }[];
  peakHour?: number;
  peakHourMessages?: number;
  isLoading?: boolean;
  periodLabel?: string;
}

export function ConversationRhythmSection({ 
  messagesPerDay, 
  peakHour,
  peakHourMessages,
  isLoading,
  periodLabel = "período"
}: ConversationRhythmSectionProps) {
  const chartConfig = {
    count: {
      label: "Mensagens",
      color: "hsl(var(--primary))",
    },
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}h - ${(hour + 1).toString().padStart(2, '0')}h`;
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Ritmo da Conversa" 
        subtitle={`Padrões de atividade (${periodLabel})`}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main chart - 3 columns */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : messagesPerDay.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center bg-secondary/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Sem dados de atividade</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <AreaChart data={messagesPerDay}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
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
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>

        {/* Side cards - 1 column */}
        <div className="flex flex-col gap-4">
          {/* Peak hour card */}
          <div className="rounded-lg border border-border bg-secondary/30 p-4 flex-1">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Horário mais ativo</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : peakHour !== undefined ? (
              <p className="text-lg font-semibold text-card-foreground">
                {formatHour(peakHour)}
              </p>
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
              <p className="text-lg font-semibold text-card-foreground">
                {peakHourMessages.toLocaleString('pt-BR')}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
