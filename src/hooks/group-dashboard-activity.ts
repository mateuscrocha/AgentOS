import { formatDateKeySP, getHourSP } from "@/lib/date";

export type HourlyCountPoint = { hour: number; count: number };

export type ParticipantAvatarRef = { id: string; avatarUrl: string | null };

export type MessageTimestampLike = { created_at: string };

export type ParticipantPresenceRow = {
  member_id?: string | null;
  member_avatar?: string | null;
  created_at: string;
};

export function buildHourlyActivitySummary(
  rows: MessageTimestampLike[] | null | undefined,
): {
  activityByHour: HourlyCountPoint[];
  peakHour: number | null;
  peakHourMessages: number;
} {
  const countsByHour: Record<number, number> = {};
  for (let i = 0; i < 24; i++) countsByHour[i] = 0;

  for (const row of rows ?? []) {
    const hour = getHourSP(row.created_at);
    countsByHour[hour] = (countsByHour[hour] || 0) + 1;
  }

  const activityByHour = Object.entries(countsByHour).map(([hour, count]) => ({
    hour: parseInt(hour, 10),
    count,
  }));

  const peakEntry = activityByHour.reduce(
    (max, curr) => (curr.count > max.count ? curr : max),
    { hour: 0, count: 0 },
  );

  return {
    activityByHour,
    peakHour: peakEntry.count > 0 ? peakEntry.hour : null,
    peakHourMessages: peakEntry.count,
  };
}

export function buildParticipantPresenceIndex(rows: ParticipantPresenceRow[] | null | undefined): {
  participantsByDay: Record<string, ParticipantAvatarRef[]>;
  participantsByHour: Record<number, ParticipantAvatarRef[]>;
} {
  const participantsByDay: Record<string, ParticipantAvatarRef[]> = {};
  const participantsByHour: Record<number, ParticipantAvatarRef[]> = {};
  const seenDay: Record<string, Set<string>> = {};
  const seenHour: Record<number, Set<string>> = {};

  for (let i = 0; i < 24; i++) {
    participantsByHour[i] = [];
    seenHour[i] = new Set<string>();
  }

  for (const msg of rows ?? []) {
    const memberId = msg.member_id ?? null;
    if (!memberId) continue;

    const avatarUrl = msg.member_avatar ?? null;
    const dateKey = formatDateKeySP(new Date(msg.created_at));
    const hour = getHourSP(msg.created_at);

    if (!participantsByDay[dateKey]) {
      participantsByDay[dateKey] = [];
      seenDay[dateKey] = new Set<string>();
    }

    if (!seenDay[dateKey].has(memberId)) {
      participantsByDay[dateKey].push({ id: memberId, avatarUrl });
      seenDay[dateKey].add(memberId);
    }

    if (!seenHour[hour].has(memberId)) {
      participantsByHour[hour].push({ id: memberId, avatarUrl });
      seenHour[hour].add(memberId);
    }
  }

  return { participantsByDay, participantsByHour };
}
