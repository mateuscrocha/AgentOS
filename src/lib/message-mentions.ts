export const MENTION_REGEX = /@([0-9]{5,})/g;

type MentionMemberRow = {
  whatsapp_provider_id?: string | null;
  phone_e164?: string | null;
  lid?: string | null;
  display_name?: string | null;
  name?: string | null;
};

const toDigits = (value: string) => value.replace(/\D/g, "");

export function extractMentionIds(input: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();

  for (const text of input) {
    const source = (text ?? "").toString();
    for (const match of source.matchAll(MENTION_REGEX)) {
      if (match[1]) ids.add(match[1]);
    }
  }

  return Array.from(ids).sort();
}

export function buildMentionProviderCandidates(mentionIds: string[]): string[] {
  return Array.from(
    new Set([
      ...mentionIds,
      ...mentionIds.map((id) => `${id}@c.us`),
      ...mentionIds.map((id) => `${id}@s.whatsapp.net`),
      ...mentionIds.map((id) => `${id}@lid`),
    ]),
  );
}

export function buildMentionPlusPhones(mentionIds: string[]): string[] {
  return Array.from(new Set(mentionIds.map((id) => (id.startsWith("+") ? id : `+${id}`))));
}

export function buildMentionMapFromRows(
  byProvider: MentionMemberRow[] | null | undefined,
  byPhone: MentionMemberRow[] | null | undefined,
  byLid: MentionMemberRow[] | null | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  const labelFrom = (row: MentionMemberRow) =>
    String(row.display_name || row.name || row.phone_e164 || row.lid || "").trim();

  for (const row of byProvider || []) {
    const key = toDigits(String(row.whatsapp_provider_id || ""));
    const label = labelFrom(row);
    if (key && label) map[key] = label;
  }

  for (const row of byPhone || []) {
    const key = String(row.phone_e164 || "").replace(/^\+/, "");
    const label = labelFrom(row);
    if (key && label) map[key] = label;
  }

  for (const row of byLid || []) {
    const key = toDigits(String(row.lid || ""));
    const label = labelFrom(row);
    if (key && label) map[key] = label;
  }

  return map;
}
