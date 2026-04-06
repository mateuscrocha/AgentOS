import { subDays } from "date-fns";
import { endOfDaySP, startOfDaySP } from "@/components/group-dashboard/period-utils";

export interface GroupDashboardDateRange {
  from: Date;
  to: Date;
}

export interface GroupDashboardPeriods {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  effectiveCurrEnd: Date;
  previousPeriodStart: Date;
  previousPeriodEnd: Date;
  periodDays: number;
  currentPeriodStartISO: string;
  currentPeriodEndISO: string;
  previousPeriodStartISO: string;
  previousPeriodEndISO: string;
}

export function buildGroupDashboardPeriods(args: {
  now: Date;
  dateRange?: GroupDashboardDateRange;
}): GroupDashboardPeriods {
  const { now, dateRange } = args;
  const currentPeriodEnd = dateRange?.to ?? now;
  const currentPeriodStart = dateRange?.from ?? subDays(now, 6);

  const startToday = startOfDaySP(now);
  const endToday = endOfDaySP(now);
  const isTodayRange =
    currentPeriodStart.getTime() === startToday.getTime() &&
    currentPeriodEnd.getTime() === endToday.getTime();

  const yesterdayStartSP = startOfDaySP(subDays(now, 1));
  const yesterdayEndSP = endOfDaySP(subDays(now, 1));
  const isYesterdayRange =
    currentPeriodStart.getTime() === yesterdayStartSP.getTime() &&
    currentPeriodEnd.getTime() === yesterdayEndSP.getTime();

  let effectiveCurrEnd = currentPeriodEnd;
  let previousPeriodStart: Date;
  let previousPeriodEnd: Date;

  if (isTodayRange) {
    effectiveCurrEnd = now;
    const elapsedMs = Math.max(0, effectiveCurrEnd.getTime() - startToday.getTime());
    const yesterdayStart = startOfDaySP(subDays(now, 1));
    previousPeriodStart = yesterdayStart;
    previousPeriodEnd = new Date(yesterdayStart.getTime() + elapsedMs);
  } else if (isYesterdayRange) {
    const anteontem = subDays(startOfDaySP(currentPeriodStart), 1);
    previousPeriodStart = startOfDaySP(anteontem);
    previousPeriodEnd = endOfDaySP(anteontem);
  } else {
    const lengthMs = Math.max(0, currentPeriodEnd.getTime() - currentPeriodStart.getTime());
    previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
    previousPeriodStart = new Date(previousPeriodEnd.getTime() - lengthMs);
  }

  const periodDays = Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));

  return {
    currentPeriodStart,
    currentPeriodEnd,
    effectiveCurrEnd,
    previousPeriodStart,
    previousPeriodEnd,
    periodDays,
    currentPeriodStartISO: currentPeriodStart.toISOString(),
    currentPeriodEndISO: effectiveCurrEnd.toISOString(),
    previousPeriodStartISO: previousPeriodStart.toISOString(),
    previousPeriodEndISO: previousPeriodEnd.toISOString(),
  };
}
