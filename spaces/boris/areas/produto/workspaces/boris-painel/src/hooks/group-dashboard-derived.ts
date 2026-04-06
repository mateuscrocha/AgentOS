import type { ParticipantAvatarRef } from "@/hooks/group-dashboard-activity";

export type DayCountLike = { date: string; count: number };
export type HourCountLike = { hour: number; count: number };
export type MemberOverviewLike = { id: string; messagesCount: number; avatarUrl?: string | null };

export function computeLowEffortPercentFromDailySeries(
  messagesPerDay: DayCountLike[] | null | undefined,
  periodDays: number,
): number {
  const slice = (messagesPerDay || []).slice(Math.max(0, (messagesPerDay || []).length - periodDays));
  const avg = slice.length > 0 ? Math.round(slice.reduce((sum, d) => sum + d.count, 0) / slice.length) : 0;
  const excess = slice.filter((d) => d.count > avg).length;
  const percent = periodDays > 0 ? Math.round((excess / periodDays) * 100) : 0;
  return Math.max(0, Math.min(100, 100 - percent));
}

export function computePeakTwoHourStart(activityByHour: HourCountLike[] | null | undefined): number | null {
  const hours = activityByHour || [];
  if (hours.length === 0) return null;

  let bestStart = 0;
  let bestSum = 0;
  for (let i = 0; i < 24; i++) {
    const a = hours.find((h) => h.hour === i)?.count || 0;
    const b = hours.find((h) => h.hour === ((i + 1) % 24))?.count || 0;
    const sum = a + b;
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = i;
    }
  }
  return bestSum > 0 ? bestStart : null;
}

export function pickPrioritizedAvatars(
  list: ParticipantAvatarRef[],
  recurringIds: Set<string>,
  limit = 8,
): ParticipantAvatarRef[] {
  const res: ParticipantAvatarRef[] = [];
  const seen = new Set<string>();

  for (const m of list) {
    if (res.length >= limit) break;
    if (recurringIds.has(m.id) && !seen.has(m.id)) {
      res.push(m);
      seen.add(m.id);
    }
  }

  for (const m of list) {
    if (res.length >= limit) break;
    if (!seen.has(m.id)) {
      res.push(m);
      seen.add(m.id);
    }
  }

  return res;
}

export function mergeUniqueAvatars(lists: ParticipantAvatarRef[][]): ParticipantAvatarRef[] {
  const merged: ParticipantAvatarRef[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const m of list) {
      if (!seen.has(m.id)) {
        merged.push(m);
        seen.add(m.id);
      }
    }
  }
  return merged;
}

export function buildBusyDayAvatars(args: {
  busiestDayKey: string | null;
  participantsByDay?: Record<string, ParticipantAvatarRef[]>;
  recurringIds: Set<string>;
  limit?: number;
}): ParticipantAvatarRef[] {
  const { busiestDayKey, participantsByDay, recurringIds, limit = 8 } = args;
  if (!busiestDayKey || !participantsByDay) return [];
  return pickPrioritizedAvatars(participantsByDay[busiestDayKey] || [], recurringIds, limit);
}

export function buildPeakWindowAvatars(args: {
  peakTwoHourStart: number | null;
  participantsByHour?: Record<number, ParticipantAvatarRef[]>;
  recurringIds: Set<string>;
  limit?: number;
}): ParticipantAvatarRef[] {
  const { peakTwoHourStart, participantsByHour, recurringIds, limit = 8 } = args;
  if (peakTwoHourStart === null || !participantsByHour) return [];
  const a = participantsByHour[peakTwoHourStart] || [];
  const b = participantsByHour[(peakTwoHourStart + 1) % 24] || [];
  return pickPrioritizedAvatars(mergeUniqueAvatars([a, b]), recurringIds, limit);
}

export function buildThemeAvatars(args: {
  membersOverview?: MemberOverviewLike[] | null;
  participantsByDay?: Record<string, ParticipantAvatarRef[]>;
  recurringIds: Set<string>;
  limit?: number;
}): ParticipantAvatarRef[] {
  const { membersOverview, participantsByDay, recurringIds, limit = 8 } = args;
  const recurringIdsList = (membersOverview || []).filter((m) => m.messagesCount >= 5).map((m) => m.id);
  const fromParticipants: ParticipantAvatarRef[] = [];
  const seen = new Set<string>();

  Object.values(participantsByDay || {}).forEach((arr) => {
    arr.forEach((m) => {
      if (recurringIds.has(m.id) && !seen.has(m.id)) {
        fromParticipants.push(m);
        seen.add(m.id);
      }
    });
  });

  recurringIdsList.forEach((id) => {
    if (!seen.has(id)) {
      const mo = (membersOverview || []).find((m) => m.id === id);
      fromParticipants.push({ id, avatarUrl: mo?.avatarUrl || null });
      seen.add(id);
    }
  });

  return pickPrioritizedAvatars(fromParticipants, recurringIds, limit);
}
