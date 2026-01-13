import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PeriodReport } from "./PeriodReport";

describe("PeriodReport (grupo) — Temas em destaque", () => {
  it("não renderiza Temas em destaque", () => {
    const html = renderToStaticMarkup(
      <PeriodReport
        stats={{ totalMessages7d: 120, activeMembers7d: 20, engagementRate: 0.3, totalMembers: 80 }}
        previousStats={{ totalMessages7d: 100, activeMembers7d: 18, engagementRate: 0.25 }}
        currentMembers={80}
        periodDays={7}
        memberEngagement={{ recorrentes: 10, esporadicos: 10, inativos: 60 }}
      />,
    );

    expect(html).not.toContain("Temas em destaque");
    expect(html).not.toContain("“foco total” — +42%");
    expect(html).not.toContain("Estes temas apareceram com muito mais frequência neste período.");
  });
});
