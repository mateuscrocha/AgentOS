import { describe, expect, it } from "vitest";
import {
  buildBusyDayAvatars,
  buildPeakWindowAvatars,
  buildThemeAvatars,
  computeLowEffortPercentFromDailySeries,
  computePeakTwoHourStart,
  mergeUniqueAvatars,
  pickPrioritizedAvatars,
} from "./group-dashboard-derived";

describe("computeLowEffortPercentFromDailySeries", () => {
  it("retorna percentual invertido de dias acima da média", () => {
    const value = computeLowEffortPercentFromDailySeries(
      [
        { date: "2025-02-10", count: 1 },
        { date: "2025-02-11", count: 10 },
        { date: "2025-02-12", count: 1 },
        { date: "2025-02-13", count: 10 },
      ],
      4,
    );
    expect(value).toBe(50);
  });
});

describe("computePeakTwoHourStart", () => {
  it("encontra a melhor janela de 2 horas", () => {
    const rows = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    rows[5] = { hour: 5, count: 3 };
    rows[6] = { hour: 6, count: 4 };
    rows[10] = { hour: 10, count: 10 };
    rows[11] = { hour: 11, count: 1 };
    expect(computePeakTwoHourStart(rows)).toBe(10);
  });

  it("retorna null sem atividade", () => {
    expect(computePeakTwoHourStart([])).toBeNull();
  });
});

describe("avatar helpers", () => {
  const recurringIds = new Set(["r1", "r2"]);
  const sample = [
    { id: "x", avatarUrl: null },
    { id: "r1", avatarUrl: "a" },
    { id: "y", avatarUrl: null },
    { id: "r2", avatarUrl: "b" },
  ];

  it("prioriza recorrentes e respeita limite", () => {
    expect(pickPrioritizedAvatars(sample, recurringIds, 3).map((x) => x.id)).toEqual(["r1", "r2", "x"]);
  });

  it("faz merge único preservando ordem", () => {
    expect(
      mergeUniqueAvatars([
        [{ id: "a", avatarUrl: null }, { id: "b", avatarUrl: null }],
        [{ id: "b", avatarUrl: "b" }, { id: "c", avatarUrl: null }],
      ]).map((x) => x.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("monta busy day / peak window / theme avatars", () => {
    const participantsByDay = {
      "2025-02-10": [{ id: "x", avatarUrl: null }, { id: "r1", avatarUrl: "a" }],
      "2025-02-11": [{ id: "r2", avatarUrl: "b" }],
    };
    const participantsByHour = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [{ id: "x", avatarUrl: null }, { id: "r1", avatarUrl: "a" }],
      6: [{ id: "r1", avatarUrl: "a" }, { id: "r2", avatarUrl: "b" }],
      7: [],
      8: [],
      9: [],
      10: [],
      11: [],
      12: [],
      13: [],
      14: [],
      15: [],
      16: [],
      17: [],
      18: [],
      19: [],
      20: [],
      21: [],
      22: [],
      23: [],
    } as Record<number, { id: string; avatarUrl: string | null }[]>;

    expect(
      buildBusyDayAvatars({
        busiestDayKey: "2025-02-10",
        participantsByDay,
        recurringIds,
      }).map((x) => x.id),
    ).toEqual(["r1", "x"]);

    expect(
      buildPeakWindowAvatars({
        peakTwoHourStart: 5,
        participantsByHour,
        recurringIds,
      }).map((x) => x.id),
    ).toEqual(["r1", "r2", "x"]);

    expect(
      buildThemeAvatars({
        membersOverview: [
          { id: "r1", messagesCount: 6, avatarUrl: "a" },
          { id: "r2", messagesCount: 7, avatarUrl: "b" },
        ],
        participantsByDay,
        recurringIds,
      }).map((x) => x.id),
    ).toEqual(["r1", "r2"]);
  });
});
