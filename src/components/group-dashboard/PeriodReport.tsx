import { SectionHeader } from "./SectionHeader";
import { Clock, Info } from "lucide-react";
import { KpiCard } from "./KpiCard";

type EngagementDistribution = { recorrentes: number; esporadicos: number; inativos: number };

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
}

export function PeriodReport(props: PeriodReportProps) {
  const { currentMembers, periodDays, memberEngagement } = props;
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

  const conclusion = activeMembers > 0
    ? "Existe uma comunidade ativa pequena, porém consistente."
    : "O grupo ficou mais em modo observação neste período.";

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
            help={{
              whatIs: "A parte da base ativa que aparece de forma recorrente ao longo do período.",
              howToInterpret:
                "Percentuais mais altos indicam que as mesmas pessoas voltam à conversa em vários dias. Percentuais mais baixos sugerem atividade mais pontual ou distribuída em poucos dias.",
              whatToObserve:
                "Se o volume de mensagens cresce, mas este número cai, a conversa pode estar acontecendo em poucos momentos concentrados.",
            }}
            valueClassName="text-primary/80"
            className="shadow-sm"
          />
          <KpiCard
            title="Base ativa no período"
            value={`${format(activeMembers)} membro${activeMembers === 1 ? "" : "s"}`}
            subtitle="enviaram mensagens"
            help={{
              whatIs: "Quantas pessoas enviaram pelo menos uma mensagem no período.",
              howToInterpret:
                "Ajuda a entender o tamanho da conversa: se é puxada por uma base maior ou por um grupo menor de participantes.",
              whatToObserve:
                "Compare com ‘Observadores’. Quando a base ativa encolhe e os observadores crescem, o grupo tende a ficar mais em modo leitura.",
            }}
            valueClassName="text-card-foreground"
            className="shadow-sm"
          />
          <KpiCard
            title="Observadores"
            value={`${format(observers)} pessoa${observers === 1 ? "" : "s"}`}
            subtitle="acompanharam sem enviar mensagens"
            help={{
              whatIs: "Pessoas que permaneceram no grupo, mas não enviaram mensagens no período.",
              howToInterpret:
                "Valores maiores indicam mais gente em modo acompanhamento. É comum em grupos: muita gente lê e pouca gente fala.",
              whatToObserve:
                "Se os observadores aumentam por vários períodos seguidos, pode valer testar perguntas simples ou convites à participação.",
            }}
            valueClassName="text-muted-foreground"
            className="shadow-sm"
          />
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
