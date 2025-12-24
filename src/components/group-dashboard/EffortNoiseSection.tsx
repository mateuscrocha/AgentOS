import { KpiCard } from "./KpiCard";
import { SectionHeader } from "./SectionHeader";

interface EffortNoiseSectionProps {
  stats: {
    totalMessages7d: number;
    activeMembers7d: number;
    totalMembers: number;
  };
  messagesPerDay: { date: string; count: number }[];
  membersOverview?: { id: string; name: string; displayName?: string | null; messagesCount: number }[];
  periodDays: number;
  isLoading?: boolean;
  periodLabel?: string;
  currentMembers?: number;
}

export function EffortNoiseSection({
  stats,
  messagesPerDay,
  membersOverview,
  periodDays,
  isLoading,
  periodLabel = "período",
  currentMembers = 0,
}: EffortNoiseSectionProps) {
  const msgsPerActive = stats.activeMembers7d > 0
    ? Math.round(stats.totalMessages7d / stats.activeMembers7d)
    : 0;

  const periodSlice = messagesPerDay.slice(Math.max(0, messagesPerDay.length - periodDays));
  const avgDaily = periodSlice.length > 0
    ? Math.round(periodSlice.reduce((sum, d) => sum + d.count, 0) / periodSlice.length)
    : 0;
  const excessDays = periodSlice.filter(d => d.count > avgDaily).length;

  const totalMembers = currentMembers || stats.totalMembers || 0;
  const topCount = totalMembers > 0 ? Math.max(1, Math.ceil(totalMembers * 0.1)) : 0;
  const totalMessages = stats.totalMessages7d || 0;
  const topSum = (membersOverview || [])
    .slice()
    .sort((a, b) => b.messagesCount - a.messagesCount)
    .slice(0, topCount)
    .reduce((acc, m) => acc + m.messagesCount, 0);
  const share = totalMessages > 0 ? Math.round((topSum / totalMessages) * 100) : 0;
  const distributionLabel = share >= 60 ? "concentrada" : share <= 40 ? "distribuída" : "mista";

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Esforço e Ruído"
        subtitle={`Leitura de esforço (${periodLabel})`}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Mensagens por membro ativo"
          value={msgsPerActive}
          subtitle="volume médio gerado por quem participa"
          helpText="Média de mensagens por quem participou no período. Não reflete distribuição entre todos os membros."
          isLoading={isLoading}
        />
        <KpiCard
          title="Dias com excesso de mensagens"
          value={excessDays}
          subtitle="dias mais intensos de conversa"
          helpText="Dias em que o volume superou a média diária do grupo. Indica intensidade, não problema."
          isLoading={isLoading}
        />
        <KpiCard
          title="Distribuição da atividade"
          value={distributionLabel}
          subtitle="distribuição da conversa entre participantes"
          helpText="Se a conversa está concentrada em poucos ou distribuída. Não usa pontuação ou julgamento."
          isLoading={isLoading}
        />
      </div>
    </section>
  );
}
