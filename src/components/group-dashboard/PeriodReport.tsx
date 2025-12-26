import { SectionHeader } from "./SectionHeader";
import { Link } from "react-router-dom";

interface ThemeItem { phrase: string; count: number }

interface PeriodReportProps {
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
  currentMembers: number;
  themes?: ThemeItem[];
  atRiskMembersCount?: number;
  newMembersCount?: number;
  previousNewMembersCount?: number;
  exitedMembersCount?: number;
  previousExitedMembersCount?: number;
  periodLabel?: string;
  groupId: string;
}

export function PeriodReport({
  stats,
  previousStats,
  currentMembers,
  themes = [],
  atRiskMembersCount = 0,
  newMembersCount = 0,
  previousNewMembersCount = 0,
  exitedMembersCount = 0,
  previousExitedMembersCount = 0,
  periodLabel = "período",
  groupId,
}: PeriodReportProps) {
  const prevMessages = previousStats?.totalMessages7d ?? 0;
  const messagesDelta = prevMessages > 0 ? Math.round(((stats.totalMessages7d - prevMessages) / prevMessages) * 100) : undefined;
  const participationPercent = currentMembers > 0 ? Math.round((stats.activeMembers7d / currentMembers) * 100) : 0;
  const prevParticipation = previousStats?.engagementRate;
  const participationDelta = prevParticipation !== undefined ? participationPercent - Math.round(prevParticipation) : undefined;
  const netGrowth = (newMembersCount || 0) - (exitedMembersCount || 0);
  const prevNetGrowth = (previousNewMembersCount || 0) - (previousExitedMembersCount || 0);
  const netDelta = prevNetGrowth !== undefined ? netGrowth - prevNetGrowth : undefined;

  const rhythmLabel = (() => {
    if (messagesDelta === undefined) return "";
    if (messagesDelta >= 6) return "maior";
    if (messagesDelta <= -6) return "menor";
    return "estável";
  })();

  const hasMessages = stats.totalMessages7d > 0;
  const topThemes = (themes || []).slice(0, 3);
  const showThemes = topThemes.length > 0;

  const attentionItems: string[] = [];
  if (atRiskMembersCount > 0) attentionItems.push(`${atRiskMembersCount} membros ficaram inativos`);
  if (messagesDelta !== undefined && messagesDelta <= -20) attentionItems.push(`o volume caiu ${messagesDelta}%`);
  if (participationDelta !== undefined && participationDelta < 0) attentionItems.push(`a participação caiu ${Math.abs(participationDelta)} pp`);

  const showAttention = attentionItems.length > 0;

  const goodNewsItems: string[] = [];
  if (messagesDelta !== undefined && messagesDelta > 0) goodNewsItems.push(`crescimento de +${messagesDelta}% no volume`);
  if (participationDelta !== undefined && participationDelta > 0) goodNewsItems.push(`mais membros participaram das conversas`);
  if (netDelta !== undefined && netDelta > 0) goodNewsItems.push(`saldo de membros melhor que o anterior`);

  const showGoodNews = goodNewsItems.length > 0;

  const summaryLine = (() => {
    if (!hasMessages) return "O grupo ficou inativo neste período.";
    if (messagesDelta === undefined || rhythmLabel === "estável") {
      return "Resultado geral: a conversa ficou estável em relação ao período anterior.";
    }
    if (messagesDelta < 0) {
      return `Resultado geral: houve queda de ${Math.abs(messagesDelta)}% no ritmo das conversas.`;
    }
    return `Resultado geral: o ritmo cresceu ${messagesDelta}% em relação ao anterior.`;
  })();

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Visão geral do período" 
        subtitle="Resumo inteligente do que aconteceu neste período."
      />

      <div className="space-y-6">
        {/* Bloco 0 — Resumo geral */}
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-sm font-medium text-card-foreground">{summaryLine}</p>
        </div>

        {/* Bloco 1 — Atividade */}
        {hasMessages && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-card-foreground">Atividade no período</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-card-foreground">
              <li><strong className="font-semibold">{stats.totalMessages7d.toLocaleString('pt-BR')}</strong> mensagens</li>
              <li><strong className="font-semibold">{participationPercent}%</strong> dos membros participaram</li>
            </ul>
          </div>
        )}

        {/* Bloco 2 — Temas em destaque */}
        {showThemes && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-card-foreground">Temas em destaque</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-card-foreground">
              {topThemes.map((t) => (
                <li key={t.phrase}>“{t.phrase}”</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Estes temas apareceram com mais frequência neste período.</p>
          </div>
        )}

        {/* Bloco 3 — Pontos de atenção */}
        {showAttention && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-card-foreground">⚠️ Pontos de atenção</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-card-foreground">
              {attentionItems.map((it, idx) => (
                <li key={idx}>{it}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Bloco 4 — Boas notícias */}
        {showGoodNews && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-card-foreground">Boas notícias</p>
            <ul className="pl-5 space-y-1 text-sm text-card-foreground">
              {goodNewsItems.map((it, idx) => (
                <li key={idx} className="flex items-center gap-2"><span>✅</span><span>{it}</span></li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA final */}
        <div>
          <Link to={`/groups/${groupId}#group-themes`} className="text-xs text-primary hover:underline">Ver análise detalhada →</Link>
        </div>
      </div>
    </section>
  );
}
