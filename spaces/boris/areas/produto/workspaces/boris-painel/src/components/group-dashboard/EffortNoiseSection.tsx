import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusTag } from "@/components/ui/status-tag";
import { cn } from "@/lib/utils";

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
  const hasMessages = (stats.totalMessages7d || 0) > 0;

  const msgsPerActive = stats.activeMembers7d > 0
    ? Math.round(stats.totalMessages7d / stats.activeMembers7d)
    : 0;

  const periodSlice = messagesPerDay.slice(Math.max(0, messagesPerDay.length - periodDays));
  const meanDaily = periodSlice.length > 0
    ? periodSlice.reduce((sum, d) => sum + d.count, 0) / periodSlice.length
    : 0;
  const varianceDaily = periodSlice.length > 0
    ? periodSlice.reduce((sum, d) => sum + Math.pow(d.count - meanDaily, 2), 0) / periodSlice.length
    : 0;
  const stdDaily = Math.sqrt(varianceDaily);
  const noisyThreshold = meanDaily > 0 ? meanDaily + stdDaily : 0;
  const daysAbovePattern = meanDaily > 0
    ? periodSlice.filter((d) => d.count > noisyThreshold).length
    : 0;

  const totalMembers = currentMembers || stats.totalMembers || 0;
  const topCount = totalMembers > 0 ? Math.max(1, Math.ceil(totalMembers * 0.1)) : 0;
  const totalMessages = stats.totalMessages7d || 0;
  const topSum = (membersOverview || [])
    .slice()
    .sort((a, b) => b.messagesCount - a.messagesCount)
    .slice(0, topCount)
    .reduce((acc, m) => acc + m.messagesCount, 0);
  const share = totalMessages > 0 ? Math.round((topSum / totalMessages) * 100) : 0;

  const effortQual = msgsPerActive <= 6 ? "baixo" : msgsPerActive <= 14 ? "normal" : "alto";
  const effortTone = effortQual === "baixo" ? "success" : effortQual === "normal" ? "neutral" : "warning";

  const maxIrregular = Math.max(1, Math.round(periodSlice.length * 0.15));
  const noiseQual = daysAbovePattern === 0
    ? "estável"
    : daysAbovePattern <= maxIrregular
      ? "irregular"
      : "alta variação";
  const noiseTone = noiseQual === "estável" ? "success" : noiseQual === "irregular" ? "warning" : "error";

  const distributionValue = !hasMessages
    ? "—"
    : share <= 40
      ? "bem distribuída"
      : share <= 60
        ? "moderada"
        : "concentrada";
  const distributionTone = distributionValue === "bem distribuída"
    ? "success"
    : distributionValue === "moderada"
      ? "neutral"
      : distributionValue === "concentrada"
        ? "error"
        : "neutral";

  const interpretativeLine = !hasMessages
    ? `Sem mensagens suficientes para interpretar o ${periodLabel}.`
    : `${
      distributionValue === "concentrada"
        ? "A conversa está concentrada em poucos membros"
        : distributionValue === "moderada"
          ? "A conversa está moderadamente distribuída"
          : "A conversa está bem distribuída entre os membros"
    }, ${
      noiseQual === "estável"
        ? "com ritmo estável"
        : noiseQual === "irregular"
          ? "com alguns picos fora do padrão"
          : "com picos frequentes fora do padrão"
    } e com esforço ${effortQual} para participar.`;

  const IndicatorCard = ({
    title,
    value,
    subtext,
    tag,
    variant,
    valueClassName,
  }: {
    title: string;
    value: string;
    subtext: string;
    tag: string;
    variant: "success" | "warning" | "error" | "neutral";
    valueClassName?: string;
  }) => {
    return (
      <div className="rounded-xl border border-border/80 bg-card/95 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
          <StatusTag variant={variant}>{tag}</StatusTag>
        </div>

        {isLoading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <div className="mt-2.5 space-y-1">
            <p className={cn("text-lg sm:text-xl font-semibold text-card-foreground tabular-nums", valueClassName)}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{subtext}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm">
      <SectionHeader
        title="Esforço e Ruído"
        subtitle={`Leitura qualitativa (${periodLabel})`}
      />

      <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3">
        {isLoading ? (
          <Skeleton className="h-4 w-4/5" />
        ) : (
          <p className="text-sm text-card-foreground">{interpretativeLine}</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <IndicatorCard
          title="Esforço médio por participante"
          value={`${msgsPerActive.toLocaleString("pt-BR")} msgs`}
          subtext="por membro ativo"
          tag={effortQual}
          variant={effortTone}
        />
        <IndicatorCard
          title="Dias acima do padrão"
          value={`${daysAbovePattern.toLocaleString("pt-BR")} dias`}
          subtext="no período analisado"
          tag={noiseQual}
          variant={noiseTone}
        />
        <IndicatorCard
          title="Distribuição da conversa"
          value={distributionValue}
          subtext="entre participantes"
          tag={distributionValue}
          variant={distributionTone}
          valueClassName="tabular-nums normal-case"
        />
      </div>
    </section>
  );
}
