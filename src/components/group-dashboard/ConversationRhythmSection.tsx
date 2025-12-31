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
import { formatDateTickBR } from "@/lib/date";

interface ConversationRhythmSectionProps {
  messagesPerDay: { date: string; count: number }[];
  activeMembersPerDay?: { date: string; count: number }[];
  isLoading?: boolean;
  periodLabel?: string;
}

export function ConversationRhythmSection({ 
  messagesPerDay, 
  activeMembersPerDay,
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
      
      <div className="mt-4">
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
                strokeWidth={3}
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
      </div>
    </section>
  );
}
