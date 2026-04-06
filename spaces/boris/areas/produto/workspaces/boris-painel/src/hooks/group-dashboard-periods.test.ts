import { describe, expect, it } from "vitest";
import { subDays } from "date-fns";
import { startOfDaySP, endOfDaySP } from "@/components/group-dashboard/period-utils";
import { buildGroupDashboardPeriods } from "./group-dashboard-periods";

describe("buildGroupDashboardPeriods", () => {
  it("compara 'today' com ontem até o mesmo horário decorrido", () => {
    const now = new Date("2025-02-22T15:30:00.000Z");
    const todayStart = startOfDaySP(now);
    const todayEnd = endOfDaySP(now);

    const periods = buildGroupDashboardPeriods({
      now,
      dateRange: { from: todayStart, to: todayEnd },
    });

    const yesterdayStart = startOfDaySP(subDays(now, 1));
    const elapsedMs = now.getTime() - todayStart.getTime();

    expect(periods.currentPeriodStart.toISOString()).toBe(todayStart.toISOString());
    expect(periods.currentPeriodEnd.toISOString()).toBe(todayEnd.toISOString());
    expect(periods.effectiveCurrEnd.toISOString()).toBe(now.toISOString());
    expect(periods.previousPeriodStart.toISOString()).toBe(yesterdayStart.toISOString());
    expect(periods.previousPeriodEnd.toISOString()).toBe(new Date(yesterdayStart.getTime() + elapsedMs).toISOString());
    expect(periods.currentPeriodEndISO).toBe(now.toISOString());
  });

  it("compara 'yesterday' com anteontem como dias completos", () => {
    const now = new Date("2025-02-22T15:30:00.000Z");
    const yesterday = subDays(now, 1);
    const yesterdayStart = startOfDaySP(yesterday);
    const yesterdayEnd = endOfDaySP(yesterday);
    const dayBefore = subDays(yesterday, 1);

    const periods = buildGroupDashboardPeriods({
      now,
      dateRange: { from: yesterdayStart, to: yesterdayEnd },
    });

    expect(periods.previousPeriodStart.toISOString()).toBe(startOfDaySP(dayBefore).toISOString());
    expect(periods.previousPeriodEnd.toISOString()).toBe(endOfDaySP(dayBefore).toISOString());
    expect(periods.effectiveCurrEnd.toISOString()).toBe(yesterdayEnd.toISOString());
    expect(periods.currentPeriodEndISO).toBe(yesterdayEnd.toISOString());
  });

  it("para faixa customizada usa janela anterior com mesma duração", () => {
    const now = new Date("2025-02-22T15:30:00.000Z");
    const from = new Date("2025-02-10T12:00:00.000Z");
    const to = new Date("2025-02-14T18:00:00.000Z");

    const periods = buildGroupDashboardPeriods({
      now,
      dateRange: { from, to },
    });

    const expectedPrevEnd = new Date(from.getTime() - 1);
    const expectedPrevStart = new Date(expectedPrevEnd.getTime() - (to.getTime() - from.getTime()));

    expect(periods.currentPeriodStart.toISOString()).toBe(from.toISOString());
    expect(periods.currentPeriodEnd.toISOString()).toBe(to.toISOString());
    expect(periods.effectiveCurrEnd.toISOString()).toBe(to.toISOString());
    expect(periods.previousPeriodStart.toISOString()).toBe(expectedPrevStart.toISOString());
    expect(periods.previousPeriodEnd.toISOString()).toBe(expectedPrevEnd.toISOString());
    expect(periods.previousPeriodStartISO).toBe(expectedPrevStart.toISOString());
    expect(periods.previousPeriodEndISO).toBe(expectedPrevEnd.toISOString());
    expect(periods.periodDays).toBe(Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
  });
});
