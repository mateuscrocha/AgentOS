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

  const trendSummary = (() => {
    if (isLoading) return null;
    const counts = (messagesPerDay || []).map((d) => Number(d.count) || 0);
    const nonZeroDays = counts.filter((n) => n > 0).length;
    if (counts.length < 2 || nonZeroDays === 0) return "Ainda não há tendência clara neste período.";

    const window = Math.min(3, counts.length);
    const firstAvg = counts.slice(0, window).reduce((a, b) => a + b, 0) / window;
    const lastAvg = counts.slice(-window).reduce((a, b) => a + b, 0) / window;
    const delta = lastAvg - firstAvg;
    const threshold = Math.max(1, firstAvg * 0.08);

    if (delta > threshold) return "Tendência: o ritmo ficou mais forte nos últimos dias.";
    if (delta < -threshold) return "Tendência: o ritmo perdeu força nos últimos dias.";
    return "Tendência: ritmo estável ao longo do período.";
  })();

  const emptyStateCopy = (() => {
    if ((messagesPerDay || []).length === 0) {
      return {
        title: "Ainda não há ritmo suficiente para leitura",
        description: "Quando o grupo acumular mensagens ao longo do período, este gráfico vai mostrar tendência e aceleração da conversa.",
      };
    }

    const totalMessages = (messagesPerDay || []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
    if (totalMessages === 0) {
      return {
        title: "O grupo ficou silencioso neste recorte",
        description: "Use isso como sinal de baixa tração neste período ou volte para um intervalo maior para encontrar os últimos movimentos.",
      };
    }

    return {
      title: "Sem leitura de ritmo",
      description: "Ainda não há dados suficientes para montar uma tendência confiável.",
    };
  })();

  return (
    <section className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm">
      <SectionHeader 
        title="Ritmo da Conversa" 
        subtitle={`Mensagens por dia (${periodLabel})`}
        helpText="Use para ver tendência e picos de atividade."
      />
      
      <div className="mt-4 space-y-3">
        {trendSummary ? (
          <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
            <p className="text-sm text-card-foreground/90">{trendSummary}</p>
          </div>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : messagesPerDay.length === 0 ? (
          <div className="h-[220px] rounded-lg border border-border/70 bg-secondary/20 px-6 py-5">
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-card-foreground">{emptyStateCopy.title}</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{emptyStateCopy.description}</p>
            </div>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <LineChart data={chartData}>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.25} vertical={false} />
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
                strokeWidth={2.75}
                dot={false}
                activeDot={{ r: 4 }}
              />
              {activeMembersPerDay && activeMembersPerDay.length > 0 && (
                <Line 
                  type="monotone"
                  dataKey="actives"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                  dot={false}
                  strokeOpacity={0.55}
                />
              )}
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </section>
  );
}
