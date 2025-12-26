import { MessageSquare, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PeriodType } from "./PeriodFilter";

interface SummarySectionProps {
  stats: {
    totalMessages: number;
    activeMembers: number;
    engagementRate: number;
    totalMembers: number;
  };
  previousStats?: {
    totalMessages: number;
    activeMembers: number;
    totalMembers: number;
    engagementRate: number;
  };
  currentMembers?: number;
  selectedPeriod: PeriodType;
  newMembersCount?: number;
  previousNewMembersCount?: number;
  exitedMembersCount?: number;
  previousExitedMembersCount?: number;
  isLoading?: boolean;
}

export function SummarySection({ 
  stats, 
  previousStats,
  currentMembers = 0,
  selectedPeriod,
  newMembersCount = 0,
  previousNewMembersCount = 0,
  exitedMembersCount = 0,
  previousExitedMembersCount = 0,
  isLoading,
}: SummarySectionProps) {
  const getComparisonSuffix = () => {
    switch (selectedPeriod) {
      case 'today':
        return 'vs ontem (mesmo horário)';
      case 'yesterday':
        return 'vs anteontem';
      case 'this_week':
        return 'vs semana anterior';
      case 'last_week':
        return 'vs semana anterior';
      case 'this_month':
        return 'vs mês anterior';
      case '7d':
        return 'vs 7 dias anteriores';
      case '14d':
        return 'vs 14 dias anteriores';
      case '30d':
        return 'vs 30 dias anteriores';
      case '90d':
        return 'vs 90 dias anteriores';
      case 'custom':
        return 'vs período anterior equivalente';
      default:
        return 'vs período anterior equivalente';
    }
  };
  const comparisonSuffix = getComparisonSuffix();
  
  const activePercent = currentMembers > 0 ? Math.round((stats.activeMembers / currentMembers) * 100) : 0;
  const netGrowth = (newMembersCount || 0) - (exitedMembersCount || 0);
  const previousNetGrowth = (previousNewMembersCount || 0) - (previousExitedMembersCount || 0);

  return (
    <section>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        {(() => {
          const curr = stats.totalMessages || 0;
          const prev = previousStats?.totalMessages ?? null;
          const delta = prev && prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;
          const changeLabel = (() => {
            if (prev === null) return '—';
            if (prev === 0) return 'novo';
            const d = delta as number;
            if (Math.abs(d) <= 2) return `estável ${comparisonSuffix}`;
            const sign = d >= 0 ? '+' : '';
            return `${sign}${d}% ${comparisonSuffix}`;
          })();
          const changeType = (() => {
            if (prev === null || prev === 0) return 'neutral' as const;
            const d = delta as number;
            if (Math.abs(d) <= 2) return 'neutral' as const;
            return d > 0 ? 'positive' as const : 'negative' as const;
          })();
          return (
            <StatsCard 
              title="Mensagens no período"
              value={isLoading ? '—' : curr.toLocaleString('pt-BR')}
              change={isLoading ? undefined : changeLabel}
              changeType={changeType}
              icon={MessageSquare}
              variant="kpi"
            />
          );
        })()}

        {(() => {
          const curr = stats.activeMembers || 0;
          const prev = previousStats?.activeMembers ?? null;
          const delta = prev && prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;
          const changeLabel = (() => {
            if (prev === null) return '—';
            if (prev === 0) return curr ? 'novo' : '—';
            const d = delta as number;
            if (Math.abs(d) <= 2) return `estável ${comparisonSuffix}`;
            const sign = d >= 0 ? '+' : '';
            return `${sign}${d}% ${comparisonSuffix}`;
          })();
          const changeType = (() => {
            if (prev === null || prev === 0) return 'neutral' as const;
            const d = delta as number;
            if (Math.abs(d) <= 2) return 'neutral' as const;
            return d > 0 ? 'positive' as const : 'negative' as const;
          })();
          return (
            <StatsCard 
              title="Membros ativos"
              value={isLoading ? '—' : String(curr)}
              change={isLoading ? undefined : changeLabel}
              changeType={changeType}
              icon={Users}
              variant="kpi"
              description={`${activePercent}% do total de membros`}
            />
          );
        })()}

        {(() => {
          const total = currentMembers || 0;
          const currActive = stats.activeMembers || 0;
          const prevActive = previousStats?.activeMembers ?? null;
          const currPct = total ? (currActive / total) * 100 : 0;
          const prevPct = total ? ((prevActive || 0) / total) * 100 : 0;
          const delta = currPct - prevPct;
          const changeLabel = (() => {
            if (prevActive === null) return '—';
            if (Math.abs(delta) <= 2) return `estável ${comparisonSuffix}`;
            const rounded = Math.round(delta * 10) / 10;
            const formatted = `${rounded >= 0 ? '+' : ''}${String(rounded).replace('.', ',')}`;
            return `${formatted} p.p. ${comparisonSuffix}`;
          })();
          const changeType = (() => {
            if (prevActive === null) return 'neutral' as const;
            if (Math.abs(delta) <= 2) return 'neutral' as const;
            return delta > 0 ? 'positive' as const : 'negative' as const;
          })();
          return (
            <StatsCard 
              title="Participação dos membros"
              value={isLoading ? '—' : `${Math.round(currPct)}%`}
              change={isLoading ? undefined : changeLabel}
              changeType={changeType}
              icon={TrendingUp}
              variant="kpi"
            />
          );
        })()}

        {(() => {
          const currNet = netGrowth;
          const prevNet = previousNetGrowth;
          const abs = prevNet !== undefined ? currNet - prevNet : null;
          const changeLabel = (() => {
            if (abs === null) return '—';
            if (abs === 0) return `estável ${comparisonSuffix}`;
            const sign = (abs as number) > 0 ? '+' : '';
            return `${sign}${abs} ${comparisonSuffix}`;
          })();
          const changeType = (() => {
            if (abs === null || abs === 0) return 'neutral' as const;
            return (abs as number) > 0 ? 'positive' as const : 'negative' as const;
          })();
          const icon = netGrowth >= 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <StatsCard 
              title="Crescimento líquido"
              value={isLoading ? '—' : (netGrowth >= 0 ? `+${netGrowth}` : String(netGrowth))}
              change={isLoading ? undefined : changeLabel}
              changeType={changeType}
              icon={icon}
              variant="kpi"
              description={`entradas: +${newMembersCount} · saídas: -${exitedMembersCount}`}
            />
          );
        })()}
      </div>
    </section>
  );
}
