import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, subDays, subWeeks } from "date-fns";

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

export function getDateRange(period: PeriodType, customRange?: DateRange): DateRange {
  const now = new Date();

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_week': {
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return { from: lastWeekStart, to: lastWeekEnd };
    }
    case '7d':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '14d':
      return { from: startOfDay(subDays(now, 13)), to: endOfDay(now) };
    case '30d':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case '90d':
      return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) };
    case 'custom':
      return customRange || { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    default:
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
  }
}

