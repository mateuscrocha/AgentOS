import { addDays, addMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { SAO_PAULO_TZ } from "@/lib/date";

export type PeriodType =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | '7d'
  | '14d'
  | '30d'
  | '90d'
  | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

export function startOfDaySP(date: Date): Date {
  const dStr = formatInTimeZone(date, SAO_PAULO_TZ, "yyyy-MM-dd");
  return fromZonedTime(`${dStr}T00:00:00`, SAO_PAULO_TZ);
}

export function endOfDaySP(date: Date): Date {
  const dStr = formatInTimeZone(date, SAO_PAULO_TZ, "yyyy-MM-dd");
  const start = fromZonedTime(`${dStr}T00:00:00`, SAO_PAULO_TZ);
  const nextStart = addDays(start, 1);
  return new Date(nextStart.getTime() - 1);
}

export function getDateRange(period: PeriodType, customRange?: DateRange): DateRange {
  const now = new Date();
 
  const todayStartUTC = startOfDaySP(now);
  const todayEndUTC = endOfDaySP(now);
  const isoDow = Number(formatInTimeZone(now, SAO_PAULO_TZ, "i"));

  switch (period) {
    case 'today': {
      return { from: todayStartUTC, to: todayEndUTC };
    }
    case 'yesterday': {
      const yStart = addDays(todayStartUTC, -1);
      const yStr = formatInTimeZone(yStart, SAO_PAULO_TZ, "yyyy-MM-dd");
      const from = fromZonedTime(`${yStr}T00:00:00`, SAO_PAULO_TZ);
      const to = new Date(addDays(from, 1).getTime() - 1);
      return { from, to };
    }
    case 'this_week': {
      const mondayStart = addDays(todayStartUTC, -(isoDow - 1));
      const from = fromZonedTime(`${formatInTimeZone(mondayStart, SAO_PAULO_TZ, "yyyy-MM-dd")}T00:00:00`, SAO_PAULO_TZ);
      const to = new Date(addDays(from, 7).getTime() - 1);
      return { from, to };
    }
    case 'last_week': {
      const mondayStartPrev = addDays(todayStartUTC, -(isoDow - 1 + 7));
      const from = fromZonedTime(`${formatInTimeZone(mondayStartPrev, SAO_PAULO_TZ, "yyyy-MM-dd")}T00:00:00`, SAO_PAULO_TZ);
      const to = new Date(addDays(from, 7).getTime() - 1);
      return { from, to };
    }
    case 'this_month': {
      const ym = formatInTimeZone(now, SAO_PAULO_TZ, "yyyy-MM");
      const from = fromZonedTime(`${ym}-01T00:00:00`, SAO_PAULO_TZ);
      const nextMonthStr = formatInTimeZone(addMonths(from, 1), SAO_PAULO_TZ, "yyyy-MM");
      const nextStart = fromZonedTime(`${nextMonthStr}-01T00:00:00`, SAO_PAULO_TZ);
      const to = new Date(nextStart.getTime() - 1000);
      return { from, to };
    }
    case '7d': {
      const startStr = formatInTimeZone(addDays(todayStartUTC, -6), SAO_PAULO_TZ, "yyyy-MM-dd");
      const from = fromZonedTime(`${startStr}T00:00:00`, SAO_PAULO_TZ);
      const to = todayEndUTC;
      return { from, to };
    }
    case '14d': {
      const startStr = formatInTimeZone(addDays(todayStartUTC, -13), SAO_PAULO_TZ, "yyyy-MM-dd");
      const from = fromZonedTime(`${startStr}T00:00:00`, SAO_PAULO_TZ);
      const to = todayEndUTC;
      return { from, to };
    }
    case '30d': {
      const startStr = formatInTimeZone(addDays(todayStartUTC, -29), SAO_PAULO_TZ, "yyyy-MM-dd");
      const from = fromZonedTime(`${startStr}T00:00:00`, SAO_PAULO_TZ);
      const to = todayEndUTC;
      return { from, to };
    }
    case '90d': {
      const startStr = formatInTimeZone(addDays(todayStartUTC, -89), SAO_PAULO_TZ, "yyyy-MM-dd");
      const from = fromZonedTime(`${startStr}T00:00:00`, SAO_PAULO_TZ);
      const to = todayEndUTC;
      return { from, to };
    }
    case 'custom': {
      if (customRange?.from && customRange?.to) return customRange;
      const startStr = formatInTimeZone(addDays(todayStartUTC, -6), SAO_PAULO_TZ, "yyyy-MM-dd");
      const from = fromZonedTime(`${startStr}T00:00:00`, SAO_PAULO_TZ);
      const to = todayEndUTC;
      return { from, to };
    }
    default: {
      const startStr = formatInTimeZone(addDays(todayStartUTC, -6), SAO_PAULO_TZ, "yyyy-MM-dd");
      const from = fromZonedTime(`${startStr}T00:00:00`, SAO_PAULO_TZ);
      const to = todayEndUTC;
      return { from, to };
    }
}
}
