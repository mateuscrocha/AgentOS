import { SectionHeader } from "./SectionHeader";
import { KpiCard } from "./KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";

interface MemberOverviewItem {
  id: string;
  name: string;
  displayName?: string | null;
  messagesCount: number;
}

interface ParticipationQualitySectionProps {
  membersOverview: MemberOverviewItem[];
  previousMembersOverview?: MemberOverviewItem[];
  stats: {
    totalMembers: number;
    totalMessages7d: number;
    activeMembers7d: number;
  };
  previousStats?: {
    totalMessages7d: number;
    engagementRate: number;
  };
  isLoading?: boolean;
  periodLabel?: string;
}

export function ParticipationQualitySection({
  membersOverview,
  previousMembersOverview,
  stats,
  previousStats,
  isLoading,
  periodLabel = "período",
}: ParticipationQualitySectionProps) {
  const data = membersOverview
    .filter(m => m.messagesCount > 0)
    .sort((a, b) => b.messagesCount - a.messagesCount)
    .slice(0, 10)
    .map(m => ({
      name: m.displayName || m.name || "—",
      count: m.messagesCount,
    }));

  const totalMembers = stats.totalMembers || 0;
  const topCount = totalMembers > 0 ? Math.max(1, Math.ceil(totalMembers * 0.1)) : 0;
  const totalMessages = stats.totalMessages7d || 0;
  const topSum = membersOverview
    .slice()
    .sort((a, b) => b.messagesCount - a.messagesCount)
    .slice(0, topCount)
    .reduce((acc, m) => acc + m.messagesCount, 0);
  const concentration = totalMessages > 0 ? Math.round((topSum / totalMessages) * 100) : 0;

  const prevTotalMessages = previousStats?.totalMessages7d || 0;
  const prevTopSum = (previousMembersOverview || [])
    .slice()
    .sort((a, b) => b.messagesCount - a.messagesCount)
    .slice(0, topCount)
    .reduce((acc, m) => acc + m.messagesCount, 0);
  const prevConcentration = prevTotalMessages > 0 ? Math.round((prevTopSum / prevTotalMessages) * 100) : undefined;
  const concentrationTrend = prevConcentration !== undefined ? concentration - prevConcentration : undefined;

  const silentPercent = totalMembers > 0
    ? Math.round(((totalMembers - (stats.activeMembers7d || 0)) / totalMembers) * 100)
    : 0;
  const prevSilentPercent = previousStats?.engagementRate !== undefined
    ? Math.round(100 - previousStats.engagementRate)
    : undefined;
  const silentTrend = prevSilentPercent !== undefined ? silentPercent - prevSilentPercent : undefined;

  const chartConfig = {
    count: {
      label: "Mensagens",
    },
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Qualidade da Participação"
        subtitle={`Distribuição e concentração (${periodLabel})`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          {isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : data.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center bg-secondary/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Sem membros ativos no período</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <KpiCard
            title="Concentração de mensagens"
            value={`${concentration}%`}
            subtitle="quanto da conversa vem de poucos"
            helpText="Quanto da conversa vem do topo dos participantes. Não avalia se isso é bom ou ruim."
            trend={concentrationTrend !== undefined ? { value: concentrationTrend, label: "vs anterior" } : undefined}
            isLoading={isLoading}
          />
          <KpiCard
            title="Taxa de silêncio"
            value={`${silentPercent}%`}
            subtitle="membros sem mensagem no período"
            trend={silentTrend !== undefined ? { value: silentTrend, label: "vs anterior" } : undefined}
            isLoading={isLoading}
          />
        </div>
      </div>
    </section>
  );
}
