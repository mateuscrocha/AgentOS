import { MessageSquare, Users, TrendingUp, UserPlus } from "lucide-react";
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
  newMembersCount?: number;
  previousNewMembersCount?: number;
  isLoading?: boolean;
  periodLabel?: string;
}

export function SummarySection({ 
  stats, 
  previousStats,
  newMembersCount = 0,
  previousNewMembersCount = 0,
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

  const newMembersTrend = calculateAbsoluteTrend(newMembersCount, previousNewMembersCount);

  return (
    <section>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          title={`Mensagens (${periodLabel})`}
          value={stats.totalMessages7d.toLocaleString('pt-BR')}
          icon={MessageSquare}
          trend={messagesTrend !== undefined ? { value: messagesTrend, label: "vs anterior" } : undefined}
          isLoading={isLoading}
        />
        
        <KpiCard
          title={`Membros ativos (${periodLabel})`}
          value={stats.activeMembers7d}
          icon={Users}
          trend={activeMembersTrend !== undefined ? { value: activeMembersTrend, label: "vs anterior" } : undefined}
          isLoading={isLoading}
        />
        
        <KpiCard
          title="Taxa de engajamento"
          value={`${stats.engagementRate}%`}
          icon={TrendingUp}
          trend={engagementTrend !== undefined ? { value: Math.round(engagementTrend), label: "pp" } : undefined}
          isLoading={isLoading}
        />
        
        <KpiCard
          title="Total de membros"
          value={stats.totalMembers}
          icon={Users}
          isLoading={isLoading}
        />
        
        <KpiCard
          title={`Novos membros (${periodLabel})`}
          value={newMembersCount >= 0 ? `+${newMembersCount}` : newMembersCount.toString()}
          icon={UserPlus}
          trend={newMembersTrend !== undefined && newMembersTrend !== 0 ? { value: newMembersTrend, label: "vs anterior", isAbsolute: true } : undefined}
          isLoading={isLoading}
        />
      </div>
    </section>
  );
}
