export type MemberIdRow = { id: string };
export type MemberMessageCountRow = { member_id?: string | null };
export type ExternalMemberEventRow = { member_lid?: string | null };

export type EngagementDistribution = {
  recorrentes: number;
  esporadicos: number;
  inativos: number;
};

export function buildMemberEngagementDistribution(
  members: MemberIdRow[] | null | undefined,
  messageRows: MemberMessageCountRow[] | null | undefined,
): EngagementDistribution {
  if (!members) {
    return { recorrentes: 0, esporadicos: 0, inativos: 0 };
  }

  const counts: Record<string, number> = {};
  for (const msg of messageRows ?? []) {
    const memberId = msg.member_id ?? null;
    if (!memberId) continue;
    counts[memberId] = (counts[memberId] || 0) + 1;
  }

  let recorrentes = 0;
  let esporadicos = 0;
  let inativos = 0;

  for (const member of members) {
    const count = counts[member.id] || 0;
    if (count >= 5) recorrentes++;
    else if (count >= 1) esporadicos++;
    else inativos++;
  }

  return { recorrentes, esporadicos, inativos };
}

export function countUniqueExternalMembers(rows: ExternalMemberEventRow[] | null | undefined): number {
  const unique = new Set<string>();
  for (const row of rows ?? []) {
    const id = (row.member_lid || "").toString().trim();
    if (id) unique.add(id);
  }
  return unique.size;
}
