export type ActiveInboundMessageLike = {
  member_id?: string | null;
  sender_phone?: string | null;
};

export type RankedParticipant = {
  id: string;
  name: string;
  count: number;
  avatarUrl: string | null;
};

export type ParticipantMessageLike = {
  member_id?: string | null;
  members?: {
    name?: string | null;
    profile_pic_url?: string | null;
  } | null;
};

export function countActiveInboundPeople(rows?: ActiveInboundMessageLike[] | null): number {
  const uniqueActivePeople = new Set<string>();
  let hasUnknownInbound = false;

  for (const msg of rows ?? []) {
    const key = (msg.member_id as string | null) || (msg.sender_phone as string | null);
    if (key) {
      uniqueActivePeople.add(key);
    } else {
      hasUnknownInbound = true;
    }
  }

  return uniqueActivePeople.size + (hasUnknownInbound ? 1 : 0);
}

export function rankParticipantsByMessages(rows?: ParticipantMessageLike[] | null): RankedParticipant[] {
  const memberCounts: Record<string, Omit<RankedParticipant, "id">> = {};

  for (const msg of rows ?? []) {
    const memberId = msg.member_id;
    if (!memberId) continue;

    const memberName = msg.members?.name || "Desconhecido";
    const avatarUrl = msg.members?.profile_pic_url || null;

    if (!memberCounts[memberId]) {
      memberCounts[memberId] = { name: memberName, count: 0, avatarUrl };
    }

    memberCounts[memberId].count++;

    if (!memberCounts[memberId].avatarUrl && avatarUrl) {
      memberCounts[memberId].avatarUrl = avatarUrl;
    }
  }

  return Object.entries(memberCounts)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count);
}
