import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { SAO_PAULO_TZ } from "@/lib/date";

export type BusinessHoursConfig = {
  timezone: string;
  workdaysIso: number[]; // 1=Mon ... 7=Sun
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

export const DEFAULT_SUPPORT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: SAO_PAULO_TZ,
  workdaysIso: [1, 2, 3, 4, 5],
  startHour: 8,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function localDateKey(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

function localIsoWeekday(date: Date, timezone: string) {
  return Number(formatInTimeZone(date, timezone, "i"));
}

function localDateTimeToUtc(dateKey: string, hour: number, minute: number, timezone: string) {
  return fromZonedTime(`${dateKey}T${pad2(hour)}:${pad2(minute)}:00`, timezone);
}

export function businessMsBetween(
  startInput: string | Date,
  endInput: string | Date,
  config: BusinessHoursConfig = DEFAULT_SUPPORT_BUSINESS_HOURS,
) {
  const start = typeof startInput === "string" ? new Date(startInput) : startInput;
  const end = typeof endInput === "string" ? new Date(endInput) : endInput;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 0;

  const startDayKey = localDateKey(start, config.timezone);
  const endDayKey = localDateKey(end, config.timezone);
  let cursor = localDateTimeToUtc(startDayKey, 0, 0, config.timezone);
  let totalMs = 0;

  // Safety cap for malformed timezone/date loops.
  for (let i = 0; i < 370; i += 1) {
    const dayKey = localDateKey(cursor, config.timezone);
    const weekday = localIsoWeekday(cursor, config.timezone);
    if (config.workdaysIso.includes(weekday)) {
      const windowStart = localDateTimeToUtc(dayKey, config.startHour, config.startMinute, config.timezone);
      const windowEnd = localDateTimeToUtc(dayKey, config.endHour, config.endMinute, config.timezone);
      const overlapStart = start > windowStart ? start : windowStart;
      const overlapEnd = end < windowEnd ? end : windowEnd;
      const delta = overlapEnd.getTime() - overlapStart.getTime();
      if (delta > 0) totalMs += delta;
    }

    if (dayKey >= endDayKey) break;
    cursor = addDays(cursor, 1);
  }

  return totalMs;
}

