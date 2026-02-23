import { subDays } from "date-fns";
import { formatDateKeySP } from "@/lib/date";

export type DayCountPoint = { date: string; count: number };

function initDailyCountMap(periodDays: number, currentPeriodEnd: Date): Record<string, number> {
  const countsByDay: Record<string, number> = {};
  for (let i = periodDays - 1; i >= 0; i--) {
    const date = subDays(currentPeriodEnd, i);
    countsByDay[formatDateKeySP(date)] = 0;
  }
  return countsByDay;
}

export function buildDailyCountSeries<T>(
  rows: T[] | null | undefined,
  args: {
    periodDays: number;
    currentPeriodEnd: Date;
    getDate: (row: T) => Date;
  },
): DayCountPoint[] {
  const countsByDay = initDailyCountMap(args.periodDays, args.currentPeriodEnd);

  for (const row of rows ?? []) {
    const dateKey = formatDateKeySP(args.getDate(row));
    if (countsByDay[dateKey] !== undefined) {
      countsByDay[dateKey] += 1;
    }
  }

  return Object.entries(countsByDay).map(([date, count]) => ({ date, count }));
}

export function buildDailyUniqueCountSeries<T>(
  rows: T[] | null | undefined,
  args: {
    periodDays: number;
    currentPeriodEnd: Date;
    getDate: (row: T) => Date;
    getKey: (row: T) => string | null | undefined;
  },
): DayCountPoint[] {
  const setsByDay: Record<string, Set<string>> = {};

  for (let i = args.periodDays - 1; i >= 0; i--) {
    const date = subDays(args.currentPeriodEnd, i);
    setsByDay[formatDateKeySP(date)] = new Set<string>();
  }

  for (const row of rows ?? []) {
    const key = args.getKey(row);
    if (!key) continue;
    const dateKey = formatDateKeySP(args.getDate(row));
    setsByDay[dateKey]?.add(key);
  }

  return Object.entries(setsByDay).map(([date, set]) => ({ date, count: set.size }));
}
