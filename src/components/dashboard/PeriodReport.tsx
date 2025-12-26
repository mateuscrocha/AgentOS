import { Link } from "react-router-dom";

interface BigramItem { phrase: string; delta: number }

interface PeriodReportSystemProps {
  messagesCurrent: number;
  messagesPrev: number;
  activeMembersCurrent: number;
  totalMembers: number;
  activeOrgsCurrent: number;
  totalOrgs: number;
  trendingBigrams?: BigramItem[];
}

export function PeriodReportSystem({
  messagesCurrent,
  messagesPrev,
  activeMembersCurrent,
  totalMembers,
  activeOrgsCurrent,
  totalOrgs,
  trendingBigrams = [],
}: PeriodReportSystemProps) {
  const messagesDelta = messagesPrev > 0 ? Math.round(((messagesCurrent - messagesPrev) / messagesPrev) * 100) : undefined;
  const participationPercent = totalMembers > 0 ? Math.round((activeMembersCurrent / totalMembers) * 100) : 0;
  const inactiveOrgs = Math.max(0, (totalOrgs || 0) - (activeOrgsCurrent || 0));

  const rhythmLabel = (() => {
    if (messagesDelta === undefined) return "";
    if (messagesDelta >= 6) return "maior";
    if (messagesDelta <= -6) return "menor";
    return "estável";
  })();

  const hasMessages = messagesCurrent > 0;
  const topThemes = (trendingBigrams || [])
    .filter((b) => (b.delta || 0) > 0)
    .sort((a, b) => (b.delta || 0) - (a.delta || 0))
    .slice(0, 3);
  const showThemes = topThemes.length > 0;

  const attentionItems: string[] = [];
  if (inactiveOrgs > 0) attentionItems.push(`${inactiveOrgs} organizações ficaram inativas`);
  if (messagesDelta !== undefined && messagesDelta <= -20) attentionItems.push(`o volume caiu ${messagesDelta}%`);

  const showAttention = attentionItems.length > 0;

  const goodNewsItems: string[] = [];
  if (messagesDelta !== undefined && messagesDelta > 0) goodNewsItems.push(`crescimento de +${messagesDelta}% no volume`);
  if (activeOrgsCurrent > 0) goodNewsItems.push(`grupos ativos em várias organizações`);
  if (participationPercent > 0) goodNewsItems.push(`mais membros participaram das conversas`);

  const showGoodNews = goodNewsItems.length > 0;

  const summaryLine = (() => {
    if (!hasMessages) return "Os grupos ficaram inativos neste período.";
    if (messagesDelta === undefined || rhythmLabel === "estável") {
      return "Resultado geral: a conversa ficou estável em relação ao período anterior.";
    }
    if (messagesDelta < 0) {
      return `Resultado geral: houve queda de ${Math.abs(messagesDelta)}% no ritmo das conversas.`;
    }
    return `Resultado geral: o ritmo cresceu ${messagesDelta}% em relação ao anterior.`;
  })();

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-6">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-card-foreground">Visão geral do período</h3>
        <p className="text-xs text-muted-foreground">Resumo inteligente do que aconteceu neste período.</p>
      </div>

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
              <li><strong className="font-semibold">{messagesCurrent.toLocaleString('pt-BR')}</strong> mensagens</li>
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
                <li key={t.phrase}>“{t.phrase}” — +{t.delta}%</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Estes temas apareceram com muito mais frequência neste período.</p>
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
          <Link to="/system/groups" className="text-xs text-primary hover:underline">Ver análise detalhada →</Link>
        </div>
      </div>
    </div>
  );
}
