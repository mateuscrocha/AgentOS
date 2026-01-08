import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PeriodReport } from "./PeriodReport";

describe("PeriodReport (grupo) — Temas em destaque", () => {
  it("renderiza a seção e formatação idêntica ao dashboard da Central", () => {
    const html = renderToStaticMarkup(
      <PeriodReport
        stats={{ totalMessages7d: 120, activeMembers7d: 20, engagementRate: 0.3, totalMembers: 80 }}
        previousStats={{ totalMessages7d: 100, activeMembers7d: 18, engagementRate: 0.25 }}
        currentMembers={80}
        periodDays={7}
        memberEngagement={{ recorrentes: 10, esporadicos: 10, inativos: 60 }}
        previousMemberEngagement={{ recorrentes: 9, esporadicos: 9, inativos: 62 }}
        groupId="00000000-0000-4000-8000-000000000000"
        trendingBigrams={[
          { phrase: "foco total", delta: 42 },
          { phrase: "queda forte", delta: -10 },
        ]}
      />,
    );

    expect(html).toContain("Temas em destaque");
    expect(html).toContain("“foco total” — +42%");
    expect(html).not.toContain("queda forte");
    expect(html).toContain("Estes temas apareceram com muito mais frequência neste período.");
  });
});

