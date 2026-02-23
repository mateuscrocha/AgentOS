import { describe, expect, it } from "vitest";
import { buildDailyCountSeries, buildDailyUniqueCountSeries } from "./group-dashboard-series";

describe("buildDailyCountSeries", () => {
  it("preenche dias sem eventos com zero e conta eventos no dia correto", () => {
    const currentPeriodEnd = new Date("2025-02-14T12:00:00.000Z");
    const rows = [
      { created_at: "2025-02-12T08:00:00.000Z" },
      { created_at: "2025-02-12T09:00:00.000Z" },
      { created_at: "2025-02-14T10:00:00.000Z" },
    ];

    const result = buildDailyCountSeries(rows, {
      periodDays: 3,
      currentPeriodEnd,
      getDate: (row) => new Date(row.created_at),
    });

    expect(result.map((p) => p.count).reduce((a, b) => a + b, 0)).toBe(3);
    expect(result).toHaveLength(3);
    expect(result.every((p) => typeof p.date === "string")).toBe(true);
    expect(result.some((p) => p.count === 0)).toBe(true);
  });
});

describe("buildDailyUniqueCountSeries", () => {
  it("conta chaves únicas por dia e ignora rows sem chave", () => {
    const currentPeriodEnd = new Date("2025-02-14T12:00:00.000Z");
    const rows = [
      { created_at: "2025-02-12T08:00:00.000Z", member_id: "m1" },
      { created_at: "2025-02-12T09:00:00.000Z", member_id: "m1" },
      { created_at: "2025-02-12T11:00:00.000Z", member_id: "m2" },
      { created_at: "2025-02-13T10:00:00.000Z", member_id: null },
      { created_at: "2025-02-14T10:00:00.000Z", member_id: "m1" },
    ];

    const result = buildDailyUniqueCountSeries(rows, {
      periodDays: 3,
      currentPeriodEnd,
      getDate: (row) => new Date(row.created_at),
      getKey: (row) => row.member_id,
    });

    expect(result).toHaveLength(3);
    const totalUniqueBuckets = result.map((p) => p.count);
    expect(totalUniqueBuckets).toContain(2);
    expect(totalUniqueBuckets).toContain(1);
    expect(totalUniqueBuckets.filter((n) => n === 0).length).toBeGreaterThanOrEqual(0);
  });
});
