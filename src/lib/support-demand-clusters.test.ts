import { describe, expect, it } from "vitest";

import { aggregateDemandClusters, classifyDemandCluster, compareDemandClusters } from "./support-demand-clusters";

describe("support-demand-clusters", () => {
  it("classifica clusters por palavras-chave", () => {
    expect(classifyDemandCluster("Está dando erro ao salvar")).toBe("bug");
    expect(classifyDemandCluster("Não consigo fazer login")).toBe("acesso");
    expect(classifyDemandCluster("Como configurar isso?")).toBe("duvida");
    expect(classifyDemandCluster("Quero solicitar uma melhoria")).toBe("solicitacao");
    expect(classifyDemandCluster("Dúvida sobre boleto e cobrança")).toBe("financeiro");
  });

  it("agrega volume e percentual", () => {
    const stats = aggregateDemandClusters([
      "erro no sistema",
      "como faz",
      "como configurar",
      "boleto atrasado",
      "texto sem regra",
    ]);
    expect(stats[0].count).toBeGreaterThan(0);
    const duvida = stats.find((s) => s.key === "duvida");
    expect(duvida?.count).toBe(2);
    expect(Math.round(stats.reduce((acc, s) => acc + s.pct, 0))).toBe(100);
  });

  it("compara clusters entre períodos", () => {
    const stats = compareDemandClusters(
      ["erro", "erro", "como usar"],
      ["erro", "boleto"],
    );
    const bug = stats.find((s) => s.key === "bug");
    const duvida = stats.find((s) => s.key === "duvida");
    expect(bug?.count).toBe(2);
    expect(bug?.previousCount).toBe(1);
    expect(bug?.deltaCount).toBe(1);
    expect(duvida?.deltaCount).toBe(1);
  });
});
