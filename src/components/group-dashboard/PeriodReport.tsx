import { SectionHeader } from "./SectionHeader";
import { Link } from "react-router-dom";
import { Clock, Info } from "lucide-react";
import { KpiCard } from "./KpiCard";

type EngagementDistribution = { recorrentes: number; esporadicos: number; inativos: number };

type Tone = "info" | "positive" | "attention";

type BigramItem = { phrase: string; delta: number };

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
  trendingBigrams?: BigramItem[];
}

export function PeriodReport({
  stats,
  previousStats,
  currentMembers,
  periodDays,
  memberEngagement,
  previousMemberEngagement,
  groupId,
  trendingBigrams,
}: PeriodReportProps) {
  const dist = memberEngagement || { recorrentes: 0, esporadicos: 0, inativos: 0 };
  const members = Math.max(0, currentMembers || 0);
  const activeMembers = Math.max(0, (dist.recorrentes || 0) + (dist.esporadicos || 0));
  const observers = Math.max(0, members - activeMembers);
  const activePercent = members > 0 ? Math.round((activeMembers / members) * 100) : 0;
  const participationAmongActives = activeMembers > 0 ? Math.round(((dist.recorrentes || 0) / activeMembers) * 100) : 0;
  const format = (n: number) => n.toLocaleString("pt-BR");

  const insight = activeMembers > 0
    ? `A conversa foi sustentada por uma base ativa de ${format(activeMembers)} pessoas (${activePercent}% do grupo), enquanto ${format(observers)} acompanharam como observadores — algo comum em grupos de WhatsApp.`
    : "Neste período, ninguém enviou mensagens. O grupo ficou mais em modo observação — algo comum em alguns momentos.";

  const highlights = activeMembers > 0
    ? [
        `${participationAmongActives}% dos membros ativos participaram neste período`,
        `A base ativa foi formada por ${format(activeMembers)} pessoas`,
        `${format(observers)} membros acompanharam sem enviar mensagens`,
        "Esse padrão é comum: poucos sustentam a maior parte das conversas",
      ]
    : [
        "Neste período, a base ativa ficou zerada",
        `${format(observers)} membros acompanharam sem enviar mensagens`,
        "Esse padrão é comum: poucos sustentam a maior parte das conversas",
      ];

  const conclusion = activeMembers > 0
    ? "Existe uma comunidade ativa pequena, porém consistente."
    : "O grupo ficou mais em modo observação neste período.";

  const topThemes = (trendingBigrams || [])
    .filter((b) => (b.delta || 0) > 0)
    .sort((a, b) => (b.delta || 0) - (a.delta || 0))
    .slice(0, 3);
  const showThemes = topThemes.length > 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Visão geral do período" 
        subtitle={`Leitura da base ativa do período — últimos ${periodDays} dias`}
        subtitleIcon={Clock}
        subtitleClassName="text-primary/80"
      />

      <div className="space-y-6">
        <div className="rounded-xl border border-[#F5D7A7] bg-[#FFF7E9] p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-[#C27B2D] mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-card-foreground/90 max-w-[70ch]">{insight}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            title="Participação entre os ativos"
            value={`${participationAmongActives}%`}
            subtitle="dos membros ativos participaram"
            valueClassName="text-primary/80"
            className="shadow-sm"
          />
          <KpiCard
            title="Base ativa no período"
            value={`${format(activeMembers)} membro${activeMembers === 1 ? "" : "s"}`}
            subtitle="enviaram mensagens"
            valueClassName="text-card-foreground"
            className="shadow-sm"
          />
          <KpiCard
            title="Observadores"
            value={`${format(observers)} pessoa${observers === 1 ? "" : "s"}`}
            subtitle="acompanharam sem enviar mensagens"
            valueClassName="text-muted-foreground"
            className="shadow-sm"
          />
        </div>

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

        <div className="space-y-2">
          <p className="text-sm font-semibold text-card-foreground">Destaques do período</p>
          <ul className="space-y-2 text-sm text-card-foreground/90">
            {highlights.map((text) => (
              <li key={text} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                <span className="max-w-[70ch]">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground max-w-[70ch]">{conclusion}</p>
        </div>

        <p className="text-xs text-muted-foreground/80 max-w-[70ch]">
          Os KPIs do topo mostram o total do grupo; aqui a leitura foca na base ativa e nos observadores.
        </p>
      </div>
    </section>
  );
}
