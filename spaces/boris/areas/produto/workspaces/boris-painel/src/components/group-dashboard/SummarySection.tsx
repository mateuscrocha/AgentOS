import { MessageSquare, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import type { PeriodType } from "./period-utils";

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
      default:
        return 'vs período anterior';
    }
  };
  const comparisonSuffix = getComparisonSuffix();
  
  const activePercent = currentMembers > 0 ? Math.round((stats.activeMembers / currentMembers) * 100) : 0;
  const netGrowth = (newMembersCount || 0) - (exitedMembersCount || 0);
  const previousNetGrowth = (previousNewMembersCount || 0) - (previousExitedMembersCount || 0);

  return (
    <section>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {(() => {
          const curr = stats.totalMessages || 0;
          const prev = previousStats?.totalMessages ?? null;
          const delta = prev === null ? null : Math.round(((curr - prev) / Math.max(prev, 1)) * 100);
          const changeLabel = (() => {
            if (prev === null) return '—';
            if (curr === prev) return 'sem variação';
            const d = delta as number;
            if (Math.abs(d) <= 2) return `estável ${comparisonSuffix}`;
            const sign = d >= 0 ? '+' : '';
            return `${sign}${d}% ${comparisonSuffix}`;
          })();
          const changeType = (() => {
            if (prev === null) return 'neutral' as const;
            if (curr === prev) return 'neutral' as const;
            const d = delta as number;
            if (Math.abs(d) <= 2) return 'neutral' as const;
            return d > 0 ? 'positive' as const : 'negative' as const;
          })();
          return (
            <StatsCard 
              title="Mensagens"
              value={isLoading ? '—' : curr.toLocaleString('pt-BR')}
              help={{
                whatIs: "Total de mensagens enviadas no grupo durante o período selecionado.",
                howToInterpret: "Mostra o volume bruto da conversa. Compare com o período anterior para identificar aceleração, estabilidade ou queda.",
                whatToObserve: "Leia junto de ‘Ativos’ e ‘Participação’ para ver se o volume está distribuído ou concentrado em poucas pessoas.",
              }}
              change={isLoading ? undefined : changeLabel}
              changeType={changeType}
              icon={MessageSquare}
              variant="kpi"
              className="col-span-2 md:col-span-2 rounded-xl border-primary/20 bg-primary/5 p-6 h-[128px]"
              titleClassName="text-[11px] font-semibold text-foreground/80"
              valueClassName="text-5xl sm:text-6xl text-card-foreground"
            />
          );
        })()}

        {(() => {
          const curr = stats.activeMembers || 0;
          const prev = previousStats?.activeMembers ?? null;
          const delta = prev === null ? null : Math.round(((curr - prev) / Math.max(prev, 1)) * 100);
          const changeLabel = (() => {
            if (prev === null) return '—';
            if (curr === prev) return 'sem variação';
            const d = delta as number;
            if (Math.abs(d) <= 2) return `estável ${comparisonSuffix}`;
            const sign = d >= 0 ? '+' : '';
            return `${sign}${d}% ${comparisonSuffix}`;
          })();
          const changeType = (() => {
            if (prev === null) return 'neutral' as const;
            if (curr === prev) return 'neutral' as const;
            const d = delta as number;
            if (Math.abs(d) <= 2) return 'neutral' as const;
            return d > 0 ? 'positive' as const : 'negative' as const;
          })();
          return (
            <StatsCard 
              title="Ativos"
              value={isLoading ? '—' : curr.toLocaleString('pt-BR')}
              help={{
                whatIs: "Quantidade de membros do grupo que enviaram pelo menos uma mensagem no período.",
                howToInterpret: "Mede o tamanho da base participante real, não apenas o total de membros cadastrados.",
                whatToObserve: "Compare com o percentual mostrado em ‘Participação’ e com o total de membros do grupo.",
              }}
              change={isLoading ? undefined : changeLabel}
              changeType={changeType}
              icon={Users}
              variant="kpi"
              description={`${activePercent}% do grupo`}
              className="rounded-xl border-border/80 bg-card/90 p-4 h-[104px]"
              valueClassName="text-3xl"
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
            const rounded = Math.round(delta * 10) / 10;
            if (rounded === 0) return 'sem variação';
            if (Math.abs(rounded) <= 2) return `estável ${comparisonSuffix}`;
            const formatted = `${rounded >= 0 ? '+' : ''}${String(rounded).replace('.', ',')}`;
            return `${formatted} p.p. ${comparisonSuffix}`;
          })();
          const changeType = (() => {
            if (prevActive === null) return 'neutral' as const;
            const rounded = Math.round(delta * 10) / 10;
            if (rounded === 0 || Math.abs(rounded) <= 2) return 'neutral' as const;
            return delta > 0 ? 'positive' as const : 'negative' as const;
          })();
          return (
            <StatsCard 
              title="Participação"
              value={isLoading ? '—' : `${Math.round(currPct)}%`}
              help={{
                whatIs: "Percentual de membros do grupo que participaram com mensagem no período.",
                howToInterpret: "Valores maiores indicam que uma parcela maior da base falou no período.",
                whatToObserve: "Se cair com mensagens estáveis, a conversa pode estar concentrada em menos participantes.",
              }}
              change={isLoading ? undefined : changeLabel}
              changeType={changeType}
              icon={TrendingUp}
              variant="kpi"
              className="rounded-xl border-border/80 bg-card/90 p-4 h-[104px]"
              valueClassName="text-3xl"
            />
          );
        })()}

        {(() => {
          const currNet = netGrowth;
          const prevNet = previousNetGrowth;
          const abs = currNet - prevNet;
          const base = Math.max(Math.abs(prevNet), 1);
          const pct = Math.round((abs / base) * 100);
          const changeLabel = (() => {
            if (abs === 0 || pct === 0) return `estável ${comparisonSuffix}`;
            const sign = pct > 0 ? '+' : '';
            return `${sign}${pct}% ${comparisonSuffix}`;
          })();
          const changeType = (() => {
            if (abs === 0 || pct === 0) return 'neutral' as const;
            return pct > 0 ? 'positive' as const : 'negative' as const;
          })();
          const icon = netGrowth >= 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <StatsCard 
              title="Crescimento"
              value={isLoading ? '—' : (netGrowth >= 0 ? `+${netGrowth}` : String(netGrowth))}
              help={{
                whatIs: "Saldo de crescimento do grupo no período (entradas menos saídas).",
                howToInterpret: "Valor positivo indica expansão da base; valor negativo indica retração.",
                whatToObserve: "Observe a sequência de períodos e compare com participação para avaliar qualidade do crescimento.",
              }}
              change={isLoading ? undefined : changeLabel}
              changeType={changeType}
              icon={icon}
              variant="kpi"
              className="rounded-xl border-border/80 bg-card/90 p-4 h-[104px]"
              valueClassName="text-3xl"
            />
          );
        })()}
      </div>
    </section>
  );
}
