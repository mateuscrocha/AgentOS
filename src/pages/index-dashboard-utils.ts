export type DashboardChangeTone = "positive" | "negative" | "neutral";

export type ParticipationChangeInput = {
  currentTotalMembers: number;
  previousTotalMembers: number | null;
  currentActiveMembers: number;
  previousActiveMembers: number | null;
};

export type ParticipationChangeResult = {
  label: string;
  type: DashboardChangeTone;
};

export type GroupMomentumResult = {
  label: string;
  shortLabel: string;
  type: DashboardChangeTone;
};

export type DaySummaryInput = {
  isLoading: boolean;
  hasError: boolean;
  newGroupsCount: number;
  totalMessages: number;
  activeGroups: number;
  concentration: "alta" | "média" | "baixa";
  sharePct?: number;
  topGroupCount?: number;
  formatNumber: (value: number) => string;
};

export function buildGroupMomentum(currentCount: number, previousCount: number | null): GroupMomentumResult {
  if (previousCount === null) {
    return { label: "Sem base anterior para comparar", shortLabel: "Sem base", type: "neutral" };
  }

  if (previousCount === 0) {
    if (currentCount === 0) {
      return { label: "Sem atividade nas duas janelas", shortLabel: "Sem atividade", type: "neutral" };
    }
    return { label: "Novo pico nas últimas 24h", shortLabel: "Novo", type: "positive" };
  }

  const deltaPct = Math.round(((currentCount - previousCount) / previousCount) * 100);
  if (Math.abs(deltaPct) <= 5) {
    return { label: "Estável vs. 24h anteriores", shortLabel: "Estável", type: "neutral" };
  }

  if (deltaPct > 0) {
    return { label: `Subiu ${deltaPct}% vs. 24h anteriores`, shortLabel: `+${deltaPct}%`, type: "positive" };
  }

  return { label: `Caiu ${Math.abs(deltaPct)}% vs. 24h anteriores`, shortLabel: `${deltaPct}%`, type: "negative" };
}

export function buildParticipationChange({
  currentTotalMembers,
  previousTotalMembers,
  currentActiveMembers,
  previousActiveMembers,
}: ParticipationChangeInput): ParticipationChangeResult {
  if (!currentTotalMembers || !previousTotalMembers || previousActiveMembers === null) {
    return { label: "—", type: "neutral" };
  }

  const currPct = (currentActiveMembers / currentTotalMembers) * 100;
  const prevPct = (previousActiveMembers / previousTotalMembers) * 100;
  const rounded = Math.round((currPct - prevPct) * 10) / 10;

  if (rounded === 0 || Math.abs(rounded) <= 2) {
    return { label: "Estável", type: "neutral" };
  }

  const formatted = String(Math.abs(rounded)).replace(".", ",");
  return {
    label: rounded > 0
      ? `Subiu ${formatted} p.p. em relação ao período anterior`
      : `Caiu ${formatted} p.p. em relação ao período anterior`,
    type: rounded > 0 ? "positive" : "negative",
  };
}

export function buildSystemDaySummary({
  isLoading,
  hasError,
  newGroupsCount,
  totalMessages,
  activeGroups,
  concentration,
  sharePct,
  topGroupCount,
  formatNumber,
}: DaySummaryInput): string {
  if (isLoading) return "Carregando leitura das últimas 24h…";
  if (hasError) {
    return "Não foi possível consolidar a leitura operacional das últimas 24h no momento. Atualize a página em instantes.";
  }

  if (typeof sharePct === "number" && topGroupCount && totalMessages > 0) {
    return `${topGroupCount} grupos concentraram ${sharePct}% das mensagens nas últimas 24h. Foram criados ${newGroupsCount} grupos e ${formatNumber(activeGroups)} grupos ficaram ativos.`;
  }

  const concentrationLabel = concentration === "alta"
    ? "concentrada em poucos grupos"
    : concentration === "média"
      ? "moderadamente concentrada"
      : "bem distribuída";

  return `Nas últimas 24h, foram criados ${newGroupsCount} grupos. Houve ${formatNumber(totalMessages)} mensagens em ${formatNumber(activeGroups)} grupos, com atividade ${concentrationLabel}.`;
}
