type ParticipantLike = {
  phone?: unknown;
  name?: unknown;
  is_admin?: unknown;
  is_super_admin?: unknown;
  is_owner?: unknown;
  whatsapp_provider_id?: unknown;
};

type NormalizedParticipant = {
  phone_raw: string;
  phone_e164: string;
  whatsapp_provider_id: string;
  name: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  is_owner: boolean;
};

const isUnknownColumnError = (err: any): boolean => {
  const code = String(err?.code || '');
  const message = String(err?.message || '');
  const msg = message.toLowerCase();
  return (
    code === '42703' ||
    (msg.includes('column') && msg.includes('does not exist')) ||
    (msg.includes('column') && msg.includes('schema cache')) ||
    (msg.includes('could not find the') && msg.includes('column'))
  );
};

const isUniqueViolation = (err: any): boolean => {
  const code = String(err?.code || '');
  return code === '23505';
};

const toE164 = (raw: unknown): string | null => {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  if (s.startsWith('+')) {
    const digits = s.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('55') && digits.length >= 10) return '+' + digits;
    return '+55' + digits;
  }

  const digits = s.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length >= 10) return '+' + digits;
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  return '+' + digits;
};

const normalizeParticipants = (participants: unknown): NormalizedParticipant[] => {
  if (!Array.isArray(participants) || participants.length === 0) return [];

  const normalized = participants
    .map((p: ParticipantLike) => {
      const phoneRaw = String(p?.phone ?? '').trim();
      const phoneE164 = toE164(phoneRaw);
      if (!phoneE164) return null;

      const digits = phoneE164.replace(/\D/g, '');
      const providerId = String(p?.whatsapp_provider_id ?? '').trim() || digits;
      if (!providerId) return null;

      const isOwner = !!p?.is_owner;
      const isSuperAdmin = !!p?.is_super_admin;
      const isAdmin = !!(p?.is_admin || isOwner || isSuperAdmin);
      const nameRaw = String(p?.name ?? '').trim();
      const name = nameRaw || null;

      return {
        phone_raw: phoneRaw,
        phone_e164: phoneE164,
        whatsapp_provider_id: providerId,
        name,
        is_admin: isAdmin,
        is_super_admin: isSuperAdmin,
        is_owner: isOwner,
      } satisfies NormalizedParticipant;
    })
    .filter(Boolean) as NormalizedParticipant[];

  const unique: NormalizedParticipant[] = [];
  const seen = new Set<string>();

  for (const p of normalized) {
    const key = (p.whatsapp_provider_id || p.phone_e164).trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }

  return unique;
};

const buildRows = (args: {
  groupId: string;
  participants: NormalizedParticipant[];
  nowIso: string;
  phoneColumn: 'phone_e164' | 'phone';
  includeOwner: boolean;
  includeSuperAdmin: boolean;
  includeProvider: boolean;
  includeProviderMemberId: boolean;
  includeTiming: boolean;
  includeStatus: boolean;
}) => {
  const {
    groupId,
    participants,
    nowIso,
    phoneColumn,
    includeOwner,
    includeSuperAdmin,
    includeProvider,
    includeProviderMemberId,
    includeTiming,
    includeStatus,
  } = args;

  return participants.map((p) => {
    const base: any = {
      group_id: groupId,
      name: p.name || p.phone_raw || p.phone_e164,
      is_admin: p.is_admin,
    };

    base[phoneColumn] = p.phone_e164;

    if (includeSuperAdmin) base.is_super_admin = p.is_super_admin;
    if (includeOwner) base.is_owner = p.is_owner;
    if (includeProviderMemberId) base.whatsapp_provider_id = p.whatsapp_provider_id;
    if (includeProvider) base.provider = 'whatsapp';
    if (includeTiming) {
      base.first_seen_at = nowIso;
      base.joined_at = nowIso;
    }
    if (includeStatus) base.status = 'active';

    return base;
  });
};

export const insertMembersFromParticipantsForGroup = async (args: {
  supabase: any;
  groupId: string;
  participants: unknown;
}) => {
  const { supabase, groupId } = args;
  const participants = normalizeParticipants(args.participants);
  if (!groupId) return;
  if (participants.length === 0) return;

  const stats = {
    attempted: 0,
    inserted: 0,
    skipped_unique: 0,
    variant_index: -1,
  };

  const nowIso = new Date().toISOString();

  const variants: Array<ReturnType<typeof buildRows>> = [
    buildRows({
      groupId,
      participants,
      nowIso,
      phoneColumn: 'phone_e164',
      includeOwner: true,
      includeSuperAdmin: true,
      includeProvider: true,
      includeProviderMemberId: true,
      includeTiming: true,
      includeStatus: true,
    }),
    buildRows({
      groupId,
      participants,
      nowIso,
      phoneColumn: 'phone_e164',
      includeOwner: false,
      includeSuperAdmin: true,
      includeProvider: true,
      includeProviderMemberId: true,
      includeTiming: true,
      includeStatus: true,
    }),
    buildRows({
      groupId,
      participants,
      nowIso,
      phoneColumn: 'phone_e164',
      includeOwner: false,
      includeSuperAdmin: false,
      includeProvider: true,
      includeProviderMemberId: true,
      includeTiming: true,
      includeStatus: true,
    }),
    buildRows({
      groupId,
      participants,
      nowIso,
      phoneColumn: 'phone_e164',
      includeOwner: false,
      includeSuperAdmin: false,
      includeProvider: false,
      includeProviderMemberId: true,
      includeTiming: false,
      includeStatus: false,
    }),
    buildRows({
      groupId,
      participants,
      nowIso,
      phoneColumn: 'phone_e164',
      includeOwner: false,
      includeSuperAdmin: false,
      includeProvider: false,
      includeProviderMemberId: false,
      includeTiming: false,
      includeStatus: false,
    }),
    buildRows({
      groupId,
      participants,
      nowIso,
      phoneColumn: 'phone',
      includeOwner: false,
      includeSuperAdmin: false,
      includeProvider: false,
      includeProviderMemberId: false,
      includeTiming: false,
      includeStatus: false,
    }),
  ];

  let lastError: any = null;
  for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
    const rows = variants[variantIndex];
    let hadUnknownColumn = false;

    for (const row of rows) {
      stats.attempted += 1;
      const { error } = await supabase.from('members').insert([row]);
      if (!error) {
        stats.inserted += 1;
        continue;
      }
      if (isUniqueViolation(error)) {
        stats.skipped_unique += 1;
        continue;
      }
      if (isUnknownColumnError(error)) {
        lastError = error;
        hadUnknownColumn = true;
        break;
      }
      throw error;
    }

    if (!hadUnknownColumn) {
      stats.variant_index = variantIndex;
      return stats;
    }
  }

  if (lastError) return;
};
