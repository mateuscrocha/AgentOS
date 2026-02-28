import { describe, expect, it } from "vitest";
import { buildGroupMomentum, buildParticipationChange, buildSystemDaySummary } from "./index-dashboard-utils";

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

  it("prioriza uma leitura objetiva quando recebe share do topo", () => {
    expect(buildSystemDaySummary({
      isLoading: false,
      hasError: false,
      newGroupsCount: 2,
      totalMessages: 2562,
      activeGroups: 18,
      concentration: "alta",
      sharePct: 73,
      topGroupCount: 4,
      formatNumber,
    })).toBe("4 grupos concentraram 73% das mensagens nas últimas 24h. Foram criados 2 grupos e #18 grupos ficaram ativos.");
  });
});

describe("buildGroupMomentum", () => {
  it("retorna neutro sem base anterior", () => {
    expect(buildGroupMomentum(120, null)).toEqual({
      label: "Sem base anterior para comparar",
      shortLabel: "Sem base",
      type: "neutral",
    });
  });

  it("retorna novo pico quando antes era zero", () => {
    expect(buildGroupMomentum(120, 0)).toEqual({
      label: "Novo pico nas últimas 24h",
      shortLabel: "Novo",
      type: "positive",
    });
  });

  it("retorna estável para variação pequena", () => {
    expect(buildGroupMomentum(104, 100)).toEqual({
      label: "Estável vs. 24h anteriores",
      shortLabel: "Estável",
      type: "neutral",
    });
  });

  it("retorna subida e queda com percentual", () => {
    expect(buildGroupMomentum(150, 100)).toEqual({
      label: "Subiu 50% vs. 24h anteriores",
      shortLabel: "+50%",
      type: "positive",
    });

    expect(buildGroupMomentum(60, 100)).toEqual({
      label: "Caiu 40% vs. 24h anteriores",
      shortLabel: "-40%",
      type: "negative",
    });
  });
});
