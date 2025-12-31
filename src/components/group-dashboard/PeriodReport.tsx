import { SectionHeader } from "./SectionHeader";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";

type EngagementDistribution = { recorrentes: number; esporadicos: number; inativos: number };

type Tone = "info" | "positive" | "attention";

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
  periodDays: number;
  memberEngagement?: EngagementDistribution;
  previousMemberEngagement?: EngagementDistribution | null;
  atRiskMembersCount?: number;
  newMembersCount?: number;
  previousNewMembersCount?: number;
  exitedMembersCount?: number;
  previousExitedMembersCount?: number;
  groupId: string;
}

export function PeriodReport({
  stats,
  previousStats,
  currentMembers,
  periodDays,
  memberEngagement,
  previousMemberEngagement,
  atRiskMembersCount = 0,
  groupId,
}: PeriodReportProps) {
  const prevMessages = previousStats?.totalMessages7d ?? 0;
  const messagesDelta = prevMessages > 0 ? Math.round(((stats.totalMessages7d - prevMessages) / prevMessages) * 100) : undefined;
  const participationPercent = currentMembers > 0 ? Math.round((stats.activeMembers7d / currentMembers) * 100) : 0;
  const prevParticipation = previousStats?.engagementRate;
  const participationDelta = prevParticipation !== undefined ? participationPercent - Math.round(prevParticipation) : undefined;

  const hasMessages = stats.totalMessages7d > 0;

  const messagesTrend = (() => {
    if (!hasMessages) return "sem" as const;
    if (messagesDelta === undefined) return "desconhecido" as const;
    if (messagesDelta >= 6) return "alta" as const;
    if (messagesDelta <= -6) return "queda" as const;
    return "estavel" as const;
  })();

  const participationTrend = (() => {
    if (!hasMessages) return "sem" as const;
    if (participationDelta === undefined) return "desconhecido" as const;
    if (participationDelta >= 3) return "alta" as const;
    if (participationDelta <= -3) return "queda" as const;
    return "estavel" as const;
  })();

  const distributionInsights = (() => {
    const dist = memberEngagement || { recorrentes: 0, esporadicos: 0, inativos: 0 };
    const members = Math.max(0, currentMembers || 0);
    const active = Math.max(0, (dist.recorrentes || 0) + (dist.esporadicos || 0));
    const inactive = Math.max(0, dist.inativos || 0);
    const inactiveShare = members > 0 ? inactive / members : 0;
    const recurringShareAmongActive = active > 0 ? (dist.recorrentes || 0) / active : 0;

    const prev = previousMemberEngagement;
    const prevActive = prev ? Math.max(0, (prev.recorrentes || 0) + (prev.esporadicos || 0)) : undefined;
    const prevInactive = prev ? Math.max(0, prev.inativos || 0) : undefined;
    const prevMembers = members;
    const prevInactiveShare = prevInactive !== undefined && prevMembers > 0 ? prevInactive / prevMembers : undefined;

    const concentration = (() => {
      if (active === 0) return "sem" as const;
      if (recurringShareAmongActive >= 0.65) return "concentrada" as const;
      if (recurringShareAmongActive <= 0.35) return "distribuida" as const;
      return "mista" as const;
    })();

    const inactivity = (() => {
      if (members === 0) return "desconhecida" as const;
      if (inactiveShare >= 0.7) return "muito_alta" as const;
      if (inactiveShare >= 0.5) return "alta" as const;
      if (inactiveShare >= 0.3) return "moderada" as const;
      return "baixa" as const;
    })();

    const activityShift = (() => {
      if (prevActive === undefined) return "desconhecido" as const;
      if (active > prevActive) return "mais" as const;
      if (active < prevActive) return "menos" as const;
      return "igual" as const;
    })();

    const inactivityShift = (() => {
      if (prevInactiveShare === undefined) return "desconhecido" as const;
      if (inactiveShare <= prevInactiveShare - 0.05) return "melhorou" as const;
      if (inactiveShare >= prevInactiveShare + 0.05) return "piorou" as const;
      return "igual" as const;
    })();

    return {
      members,
      active,
      inactive,
      inactivity,
      concentration,
      activityShift,
      inactivityShift,
    };
  })();

  const headline = (() => {
    if (!hasMessages) {
      return "O grupo teve pouca atividade neste período, com baixa participação nas conversas.";
    }

    if (messagesTrend === "alta" && participationTrend === "alta") {
      if (distributionInsights.concentration === "distribuida") {
        return "O grupo ficou mais ativo neste período, com mais pessoas participando e a conversa mais distribuída.";
      }
      return "O grupo ficou mais ativo neste período, com mais pessoas participando das conversas.";
    }

    if (messagesTrend === "queda" && participationTrend === "queda") {
      return "A atividade no grupo diminuiu neste período, com menos membros participando das conversas.";
    }

    if (messagesTrend === "alta" && participationTrend === "queda") {
      return "A conversa aumentou neste período, mas com participação mais concentrada em poucas pessoas.";
    }

    if (messagesTrend === "queda" && participationTrend === "alta") {
      return "Houve menos mensagens neste período, mas com mais gente participando — um sinal de conversa mais distribuída.";
    }

    if (messagesTrend === "estavel" && participationTrend === "alta") {
      return "O ritmo da conversa ficou parecido neste período, com mais gente entrando na conversa.";
    }

    if (messagesTrend === "estavel" && participationTrend === "queda") {
      return "O ritmo da conversa ficou parecido neste período, mas com menos pessoas participando.";
    }

    if (distributionInsights.concentration === "concentrada") {
      return "O grupo manteve um ritmo de conversa estável, mas com participação concentrada em poucas pessoas.";
    }

    if (distributionInsights.inactivity === "muito_alta") {
      return "O grupo teve conversas neste período, porém com a maior parte dos membros em silêncio.";
    }

    return "O grupo teve um período de conversa estável, com espaço para ampliar a participação.";
  })();

  const highlights = (() => {
    const items: { text: string; tone: Tone }[] = [];

    const add = (text: string, tone: Tone) => {
      if (!items.some((it) => it.text === text)) items.push({ text, tone });
    };

    const state = (() => {
      if (!hasMessages) return { text: "O grupo teve baixa atividade no período.", tone: "attention" as const };
      if (distributionInsights.inactivity === "muito_alta") return { text: "A maioria dos membros permaneceu em silêncio.", tone: "attention" as const };
      if (distributionInsights.inactivity === "alta") return { text: "Muitos membros ainda permaneceram em silêncio.", tone: "attention" as const };
      return { text: "O grupo teve movimento no período.", tone: "info" as const };
    })();
    add(state.text, state.tone);

    const evolution = (() => {
      if (!hasMessages) return undefined;
      if (messagesTrend === "alta" && participationTrend === "alta") return { text: "O grupo cresceu em atividade e participação.", tone: "positive" as const };
      if (messagesTrend === "alta") return { text: "A conversa ganhou ritmo no período.", tone: "positive" as const };
      if (messagesTrend === "queda") return { text: "O ritmo da conversa diminuiu.", tone: "attention" as const };
      if (participationTrend === "alta") return { text: "Mais pessoas participaram das conversas.", tone: "positive" as const };
      if (participationTrend === "queda") return { text: "Menos pessoas entraram na conversa.", tone: "attention" as const };
      return { text: "O ritmo geral ficou parecido com o período anterior.", tone: "info" as const };
    })();
    if (evolution) add(evolution.text, evolution.tone);

    const quality = (() => {
      if (!hasMessages) return undefined;
      if (distributionInsights.concentration === "distribuida") return { text: "A conversa ficou mais distribuída entre os membros.", tone: "positive" as const };
      if (distributionInsights.concentration === "concentrada") return { text: "A conversa seguiu concentrada em poucos membros.", tone: "attention" as const };
      return { text: "A participação ficou relativamente equilibrada.", tone: "info" as const };
    })();
    if (quality) add(quality.text, quality.tone);

    const trend = (() => {
      if (!hasMessages) return undefined;
      if (distributionInsights.inactivityShift === "melhorou") {
        return { text: "Mais membros saíram do silêncio em relação ao período anterior.", tone: "positive" as const };
      }
      if (distributionInsights.inactivityShift === "piorou") {
        return { text: "Mais membros ficaram em silêncio em relação ao período anterior.", tone: "attention" as const };
      }
      if (messagesTrend === "alta" || participationTrend === "alta") return { text: "Houve sinais de melhora em relação ao período anterior.", tone: "positive" as const };
      if (messagesTrend === "queda" || participationTrend === "queda") return { text: "Houve sinais de queda em relação ao período anterior.", tone: "attention" as const };
      return undefined;
    })();
    if (trend) add(trend.text, trend.tone);

    if (items.length >= 4) return items.slice(0, 4);
    if (items.length === 3) return items;
    return items.slice(0, 3);
  })();

  const summary = (() => {
    if (!hasMessages) {
      if (distributionInsights.inactivity === "muito_alta" || distributionInsights.inactivity === "alta") {
        return "O grupo segue pouco engajado, com a maioria dos membros inativos.";
      }
      return "O período teve baixa atividade e pouca troca entre os membros.";
    }

    const positive =
      (messagesTrend === "alta" || messagesTrend === "estavel") &&
      (participationTrend === "alta") &&
      (distributionInsights.inactivity === "baixa" || distributionInsights.inactivity === "moderada") &&
      distributionInsights.concentration !== "concentrada";

    const negative =
      (messagesTrend === "queda") &&
      (participationTrend === "queda" || distributionInsights.inactivity === "muito_alta") &&
      (distributionInsights.inactivity === "alta" || distributionInsights.inactivity === "muito_alta");

    if (positive) return "A comunidade evoluiu positivamente neste período.";
    if (negative) return "O grupo perdeu ritmo e participação.";

    if (messagesTrend === "alta" && (participationTrend !== "alta" || distributionInsights.concentration === "concentrada")) {
      return "A conversa cresceu, mas ainda está concentrada em poucas pessoas.";
    }

    if (distributionInsights.inactivity === "muito_alta") {
      return "O grupo segue pouco engajado, com a maioria dos membros inativos.";
    }

    return "O período foi estável, com oportunidades claras para ampliar a participação.";
  })();

  const summaryTone: Tone = (() => {
    if (!hasMessages) {
      if (distributionInsights.inactivity === "muito_alta" || distributionInsights.inactivity === "alta") return "attention";
      return "info";
    }

    const positive =
      (messagesTrend === "alta" || messagesTrend === "estavel") &&
      (participationTrend === "alta") &&
      (distributionInsights.inactivity === "baixa" || distributionInsights.inactivity === "moderada") &&
      distributionInsights.concentration !== "concentrada";

    const negative =
      (messagesTrend === "queda") &&
      (participationTrend === "queda" || distributionInsights.inactivity === "muito_alta") &&
      (distributionInsights.inactivity === "alta" || distributionInsights.inactivity === "muito_alta");

    if (positive) return "positive";
    if (negative) return "attention";
    if (distributionInsights.concentration === "concentrada") return "attention";
    if (distributionInsights.inactivity === "muito_alta") return "attention";
    return "info";
  })();

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Visão geral do período" 
        subtitle={`Leitura inteligente dos últimos ${periodDays} dias`}
        subtitleIcon={Clock}
        subtitleClassName="text-primary/80"
      />

      <div className="space-y-6">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-card-foreground">{headline}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-card-foreground">Destaques do período</p>
          <ul className="space-y-2 text-sm text-card-foreground">
            {highlights.map((it) => (
              <li key={it.text} className="flex items-start gap-2">
                <span
                  className={
                    it.tone === "positive"
                      ? "mt-2 h-2 w-2 rounded-full bg-success/60 shrink-0"
                      : it.tone === "attention"
                        ? "mt-2 h-2 w-2 rounded-full bg-warning/60 shrink-0"
                        : "mt-2 h-2 w-2 rounded-full bg-primary/50 shrink-0"
                  }
                />
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className={
            summaryTone === "positive"
              ? "rounded-lg border border-success/20 bg-success/10 p-3"
              : summaryTone === "attention"
                ? "rounded-lg border border-warning/20 bg-warning/10 p-3"
                : "rounded-lg border border-border bg-muted/20 p-3"
          }
        >
          <div className="flex items-start gap-2.5">
            {summaryTone === "positive" ? (
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
            ) : summaryTone === "attention" ? (
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            ) : (
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <p className="text-sm text-card-foreground">Em resumo: <span className="font-medium">{summary}</span></p>
          </div>
        </div>

        <div>
          <Link to={`/groups/${groupId}#group-themes`} className="text-xs text-primary hover:underline transition-colors">Ver análise detalhada →</Link>
        </div>
      </div>
    </section>
  );
}
