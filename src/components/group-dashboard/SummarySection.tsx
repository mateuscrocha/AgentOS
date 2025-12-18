import { MessageSquare, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { KpiCard } from "./KpiCard";

interface SummarySectionProps {
  stats: {
    totalMessages7d: number;
    activeMembers7d: number;
    engagementRate: number;
    totalMembers: number;
  };
  previousStats?: {
    totalMessages7d: number;
    activeMembers7d: number;
    engagementRate: number;
  };
  periodDays: number;
  newMembersCount?: number;
  previousNewMembersCount?: number;
  exitedMembersCount?: number;
  previousExitedMembersCount?: number;
  isLoading?: boolean;
  periodLabel?: string;
}

export function SummarySection({ 
  stats, 
  previousStats,
  periodDays,
  newMembersCount = 0,
  previousNewMembersCount = 0,
  exitedMembersCount = 0,
  previousExitedMembersCount = 0,
  isLoading,
  periodLabel = "7d"
}: SummarySectionProps) {
  const calculateTrend = (current: number, previous: number | undefined) => {
    if (previous === undefined || previous === 0) return undefined;
    const change = ((current - previous) / previous) * 100;
    return Math.round(change);
  };

  const calculateAbsoluteTrend = (current: number, previous: number | undefined) => {
    if (previous === undefined) return undefined;
    return current - previous;
  };

  const messagesTrend = previousStats 
    ? calculateTrend(stats.totalMessages7d, previousStats.totalMessages7d)
    : undefined;
  
  const activeMembersTrend = previousStats
    ? calculateTrend(stats.activeMembers7d, previousStats.activeMembers7d)
    : undefined;

  const engagementTrend = previousStats
    ? stats.engagementRate - previousStats.engagementRate
    : undefined;

  const messagesAvgPerDay = periodDays > 0 ? Math.round(stats.totalMessages7d / periodDays) : stats.totalMessages7d;
  const activePercent = stats.totalMembers > 0 ? Math.round((stats.activeMembers7d / stats.totalMembers) * 100) : 0;
  const netGrowth = (newMembersCount || 0) - (exitedMembersCount || 0);
  const previousNetGrowth = (previousNewMembersCount || 0) - (previousExitedMembersCount || 0);
  const netTrend = calculateAbsoluteTrend(netGrowth, previousNetGrowth);

  return (
    <section>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        <KpiCard
          title={`Mensagens (${periodLabel})`}
          value={stats.totalMessages7d.toLocaleString('pt-BR')}
          subtitle={`média diária: ${messagesAvgPerDay.toLocaleString('pt-BR')}`}
          icon={MessageSquare}
          trend={messagesTrend !== undefined ? { value: messagesTrend, label: "vs anterior" } : undefined}
          isLoading={isLoading}
        />
        
        <KpiCard
          title={`Membros ativos (${periodLabel})`}
          value={stats.activeMembers7d}
          subtitle={`${activePercent}% do total`}
          icon={Users}
          trend={activeMembersTrend !== undefined ? { value: activeMembersTrend, label: "vs anterior" } : undefined}
          isLoading={isLoading}
        />
        
        <KpiCard
          title="Taxa de participação"
          value={`${stats.engagementRate}%`}
          icon={TrendingUp}
          trend={engagementTrend !== undefined ? { value: Math.round(engagementTrend), label: "pp" } : undefined}
          isLoading={isLoading}
        />

        <KpiCard
          title={`Crescimento líquido (${periodLabel})`}
          value={netGrowth >= 0 ? `+${netGrowth}` : netGrowth.toString()}
          subtitle={`entradas: +${newMembersCount} · saídas: -${exitedMembersCount}`}
          icon={netGrowth >= 0 ? ArrowUpRight : ArrowDownRight}
          trend={netTrend !== undefined ? { value: netTrend, label: "vs anterior", isAbsolute: true } : undefined}
          isLoading={isLoading}
        />
      </div>
    </section>
  );
}
