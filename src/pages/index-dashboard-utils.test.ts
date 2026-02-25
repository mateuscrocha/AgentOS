import { describe, expect, it } from "vitest";
import { buildParticipationChange, buildSystemDaySummary } from "./index-dashboard-utils";

describe("buildParticipationChange", () => {
  it("retorna neutro quando faltam bases para comparar", () => {
    expect(buildParticipationChange({
      currentTotalMembers: 0,
      previousTotalMembers: 100,
      currentActiveMembers: 20,
      previousActiveMembers: 15,
    })).toEqual({ label: "—", type: "neutral" });

    expect(buildParticipationChange({
      currentTotalMembers: 100,
      previousTotalMembers: null,
      currentActiveMembers: 20,
      previousActiveMembers: 15,
    })).toEqual({ label: "—", type: "neutral" });
  });

  it("retorna estável para variação pequena (<= 2 p.p.)", () => {
    expect(buildParticipationChange({
      currentTotalMembers: 100,
      previousTotalMembers: 100,
      currentActiveMembers: 31,
      previousActiveMembers: 30,
    })).toEqual({ label: "Estável", type: "neutral" });
  });

  it("retorna alta quando sobe acima de 2 p.p.", () => {
    expect(buildParticipationChange({
      currentTotalMembers: 100,
      previousTotalMembers: 80,
      currentActiveMembers: 40,
      previousActiveMembers: 20,
    })).toEqual({
      label: "Subiu 15 p.p. em relação ao período anterior",
      type: "positive",
    });
  });

  it("retorna queda quando cai acima de 2 p.p.", () => {
    expect(buildParticipationChange({
      currentTotalMembers: 100,
      previousTotalMembers: 100,
      currentActiveMembers: 10,
      previousActiveMembers: 25,
    })).toEqual({
      label: "Caiu 15 p.p. em relação ao período anterior",
      type: "negative",
    });
  });
});

describe("buildSystemDaySummary", () => {
  const formatNumber = (value: number) => `#${value}`;

  it("retorna mensagem de loading", () => {
    expect(buildSystemDaySummary({
      isLoading: true,
      hasError: false,
      newGroupsCount: 0,
      totalMessages: 0,
      activeGroups: 0,
      concentration: "baixa",
      formatNumber,
    })).toBe("Carregando leitura das últimas 24h…");
  });

  it("retorna mensagem de erro", () => {
    expect(buildSystemDaySummary({
      isLoading: false,
      hasError: true,
      newGroupsCount: 1,
      totalMessages: 10,
      activeGroups: 2,
      concentration: "alta",
      formatNumber,
    })).toBe("Não foi possível consolidar a leitura operacional das últimas 24h no momento. Atualize a página em instantes.");
  });

  it("retorna narrativa de sucesso com concentração alta", () => {
    expect(buildSystemDaySummary({
      isLoading: false,
      hasError: false,
      newGroupsCount: 3,
      totalMessages: 120,
      activeGroups: 12,
      concentration: "alta",
      formatNumber,
    })).toBe("Nas últimas 24h, foram criados 3 grupos. Houve #120 mensagens em #12 grupos, com atividade concentrada em poucos grupos.");
  });
});
