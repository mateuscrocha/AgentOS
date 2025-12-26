import { SectionHeader } from "./SectionHeader";
import { formatDateTickBR } from "@/lib/date";
import { KpiCard } from "./KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";

interface DayCount { date: string; count: number }

interface GroupGrowthSectionProps {
  entriesPerDay: DayCount[];
  exitsPerDay: DayCount[];
  currentMembers: number;
  membersAtPeriodStart?: number;
  daysWithActivity: number;
  periodDays: number;
  isLoading?: boolean;
  periodLabel?: string;
}

export function GroupGrowthSection({
  entriesPerDay,
  exitsPerDay,
  currentMembers,
  membersAtPeriodStart,
  daysWithActivity,
  periodDays,
  isLoading,
  periodLabel = "período",
}: GroupGrowthSectionProps) {
  const formatDate = (dateStr: string) => {
    return formatDateTickBR(dateStr);
  };

  const byDate: Record<string, { date: string; entradas: number; saídas: number }> = {};
  entriesPerDay.forEach(d => { byDate[d.date] = { date: d.date, entradas: d.count, saídas: 0 }; });
  exitsPerDay.forEach(d => {
    if (!byDate[d.date]) byDate[d.date] = { date: d.date, entradas: 0, saídas: d.count };
    else byDate[d.date].saídas = d.count;
  });
  const chartData = Object.values(byDate);

  const chartConfig = {
    entradas: { label: "Entradas", color: "hsl(var(--primary))" },
    saídas: { label: "Saídas", color: "hsl(var(--muted-foreground))" },
  };

  const trendMembers = membersAtPeriodStart !== undefined ? (currentMembers - membersAtPeriodStart) : undefined;
  const activeDaysPercent = periodDays > 0 ? Math.round((daysWithActivity / periodDays) * 100) : 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Crescimento do Grupo"
        subtitle={`Entradas, saídas e atividade (${periodLabel})`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          {isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center bg-secondary/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Sem dados de entradas/saídas</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="entradas" fill="hsl(var(--primary))" />
                <Bar dataKey="saídas" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <KpiCard
            title="Membros atuais"
            value={currentMembers}
            subtitle="comparado ao início do período"
            trend={trendMembers !== undefined ? { value: trendMembers, label: "vs início", isAbsolute: true } : undefined}
            isLoading={isLoading}
          />
          <KpiCard
            title="Dias com atividade"
            value={daysWithActivity}
            subtitle={`${activeDaysPercent}% dos ${periodDays} dias`}
            isLoading={isLoading}
          />
        </div>
      </div>
    </section>
  );
}
